from django.shortcuts import render
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.dateparse import parse_date
from .models import File, compute_file_hash
from .serializers import FileSerializer
from django.db import transaction, connection, OperationalError
import logging
import time

# Set up logging
logger = logging.getLogger(__name__)

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['original_filename']
    filterset_fields = ['file_type', 'is_duplicate']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        show_unique_only = self.request.query_params.get('unique_only')
        if show_unique_only and show_unique_only.lower() == 'true':
            queryset = queryset.filter(is_duplicate=False)
        
        min_size = self.request.query_params.get('min_size')
        max_size = self.request.query_params.get('max_size')
        
        if min_size:
            try:
                min_size = int(min_size)
                queryset = queryset.filter(size__gte=min_size)
            except ValueError:
                pass
                
        if max_size:
            try:
                max_size = int(max_size)
                queryset = queryset.filter(size__lte=max_size)
            except ValueError:
                pass
        
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            date_obj = parse_date(start_date)
            if date_obj:
                queryset = queryset.filter(uploaded_at__date__gte=date_obj)
                
        if end_date:
            date_obj = parse_date(end_date)
            if date_obj:
                queryset = queryset.filter(uploaded_at__date__lte=date_obj)
        
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(original_filename__icontains=search)
        
        # Collect all file types from both parameter formats
        file_types = []
        
        file_type_list = self.request.query_params.getlist('file_type')
        if file_type_list:
            file_types.extend(file_type_list)
        
        file_type_array = self.request.query_params.getlist('file_type[]')
        if file_type_array:
            file_types.extend(file_type_array)
        
        # If we have file types, build a proper OR query
        if file_types:
            file_type_q = Q()
            for ft in file_types:
                if '/' in ft:
                    # For full MIME types like 'application/pdf'
                    file_type_q |= Q(file_type__icontains=ft)
                    # Also add the subtype for more flexibility
                    subtype = ft.split('/')[-1]
                    file_type_q |= Q(file_type__icontains=subtype)
                else:
                    # For partial types like just 'pdf'
                    file_type_q |= Q(file_type__icontains=ft)
            
            queryset = queryset.filter(file_type_q)
        
        return queryset
    

    @action(detail=True, methods=['get'])
    def duplicates(self, request, pk=None):
        """
        Retrieve all duplicate files that reference this original file.
        Only works if the file is an original (non-duplicate) file.
        """
        try:
            original_file = self.get_object()
            
            if original_file.is_duplicate:
                # If this is a duplicate, redirect to its original
                if original_file.original_file:
                    return Response({
                        'error': 'This is a duplicate file itself',
                        'original_file_id': original_file.original_file.id
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({
                        'error': 'This is a duplicate file but has no reference to an original'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find all duplicates that reference this original file
            duplicates = File.objects.filter(original_file=original_file)
            serializer = self.get_serializer(duplicates, many=True)
            
            return Response({
                'original_file': self.get_serializer(original_file).data,
                'duplicate_count': duplicates.count(),
                'duplicates': serializer.data
            })
            
        except Exception as e:
            logger.error(f"Error retrieving file duplicates: {str(e)}")
            return Response(
                {'error': f'Error retrieving file duplicates: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        """
        Handle file upload with duplicate detection and prevention of double entries.
        """
        try:
            file_obj = request.FILES.get('file')
            if not file_obj:
                return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Make sure file is at the beginning
            file_obj.seek(0)
            
            try:
                file_hash = compute_file_hash(file_obj)
                # Reset file pointer to beginning after hash calculation
                file_obj.seek(0)
            except Exception as e:
                logger.error(f"Error computing file hash: {str(e)}")
                return Response(
                    {'error': f'Error processing file: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Get content type, with fallback
            content_type = getattr(file_obj, 'content_type', 'application/octet-stream')
            
            # Get file size with error handling
            try:
                file_size = file_obj.size
            except AttributeError:
                file_size = 0
                logger.warning("Could not determine file size, defaulting to 0")
            
            # Added lock detection for all database operations
            def execute_with_retry(func, max_retries=3):
                """Helper to execute functions with retry on database lock"""
                retry_count = 0
                while retry_count < max_retries:
                    try:
                        return func()
                    except OperationalError as e:
                        if "database is locked" in str(e).lower() and retry_count < max_retries - 1:
                            retry_count += 1
                            sleep_time = 0.5 * (2 ** retry_count)  # Exponential backoff
                            logger.warning(f"Database locked, retrying in {sleep_time} seconds (attempt {retry_count+1}/{max_retries})")
                            time.sleep(sleep_time)
                        else:
                            raise
                raise Exception(f"Failed after {max_retries} attempts")
                
            # Check for existing file with same hash
            existing_file = execute_with_retry(
                lambda: File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
            )
            
            # Get highest version for filename
            highest_version = execute_with_retry(
                lambda: File.objects.filter(original_filename=file_obj.name).order_by('-version').values_list('version', flat=True).first() or 0
            )
            
            with transaction.atomic():
                if existing_file:
                    # This is a duplicate file
                    logger.info(f"Duplicate file detected: {file_obj.name} matches hash of existing file {existing_file.id}")
                    
                    # Update reference count on original file
                    existing_file.reference_count = existing_file.reference_count + 1
                    existing_file.save()
                    
                    # Create a new entry that references the original file
                    new_file = File(
                        file=existing_file.file,  # Reference to existing file's storage
                        original_filename=file_obj.name,
                        file_type=content_type,
                        size=file_size,
                        file_hash=file_hash,
                        is_duplicate=True,  # Mark as duplicate
                        original_file=existing_file,  # Reference to original
                        version=highest_version + 1
                    )
                    new_file.save()
                    
                    serializer = self.get_serializer(new_file)
                    data = serializer.data
                    data['duplicate_detected'] = True
                    
                    return Response(data, status=status.HTTP_201_CREATED)
                else:
                    # This is a new unique file
                    logger.info(f"New unique file uploaded: {file_obj.name}")
                    
                    # Create new file record
                    new_file = File(
                        file=file_obj,
                        original_filename=file_obj.name,
                        file_type=content_type,
                        size=file_size,
                        file_hash=file_hash,
                        is_duplicate=False,  # Not a duplicate
                        reference_count=1,   # Initial reference count
                        version=highest_version + 1
                    )
                    new_file.save()
                    
                    serializer = self.get_serializer(new_file)
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                    
        except Exception as e:
            logger.error(f"Unhandled exception in file upload: {str(e)}")
            return Response(
                {'error': f'An unexpected error occurred during file upload: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            try:
                file_obj = request.FILES.get('file')
                if not file_obj:
                    return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Make sure file is at the beginning
                file_obj.seek(0)
                
                try:
                    file_hash = compute_file_hash(file_obj)
                    # Reset file pointer to beginning after hash calculation
                    file_obj.seek(0)
                except Exception as e:
                    logger.error(f"Error computing file hash: {str(e)}")
                    return Response(
                        {'error': f'Error processing file: {str(e)}'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                
                # Get content type, with fallback
                content_type = getattr(file_obj, 'content_type', 'application/octet-stream')
                
                # Get file size with error handling
                try:
                    file_size = file_obj.size
                except AttributeError:
                    file_size = 0
                    logger.warning("Could not determine file size, defaulting to 0")
                
                # Check for existing file outside transaction
                existing_file = None
                try:
                    existing_file = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
                except OperationalError as e:
                    if "database is locked" in str(e).lower():
                        logger.warning("Database locked during duplicate check, retrying with delay")
                        time.sleep(0.5)  # Wait briefly and retry
                        existing_file = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
                    else:
                        raise
                
                # Get highest version
                highest_version = 0
                try:
                    highest_version = File.objects.filter(
                        original_filename=file_obj.name
                    ).order_by('-version').values_list('version', flat=True).first() or 0
                except OperationalError:
                    # If we can't get the version, just default to 0
                    pass
                
                # Use smaller transactions
                if existing_file:
                    # Handle duplicate file case
                    try:
                        with transaction.atomic():
                            existing_file.reference_count = existing_file.reference_count + 1
                            existing_file.save()
                    except OperationalError as e:
                        if "database is locked" in str(e).lower():
                            # Retry after short delay
                            time.sleep(0.5)
                            with transaction.atomic():
                                # Refetch to avoid stale data
                                existing_file = File.objects.get(pk=existing_file.pk)
                                existing_file.reference_count = existing_file.reference_count + 1
                                existing_file.save()
                        else:
                            raise
                    
                    # Create duplicate record in separate transaction
                    try:
                        with transaction.atomic():
                            new_file = File(
                                file=existing_file.file,
                                original_filename=file_obj.name,
                                file_type=content_type,
                                size=file_size,
                                file_hash=file_hash,
                                is_duplicate=True,
                                original_file=existing_file,
                                version=highest_version + 1
                            )
                            new_file.save()
                    except OperationalError as e:
                        if "database is locked" in str(e).lower():
                            # Retry after short delay
                            time.sleep(1.0)
                            with transaction.atomic():
                                new_file = File(
                                    file=existing_file.file,
                                    original_filename=file_obj.name,
                                    file_type=content_type,
                                    size=file_size,
                                    file_hash=file_hash,
                                    is_duplicate=True,
                                    original_file=existing_file,
                                    version=highest_version + 1
                                )
                                new_file.save()
                        else:
                            logger.error(f"Database error creating duplicate file record: {str(e)}")
                            return Response(
                                {'error': f'Database error while saving file: {str(e)}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR
                            )
                    
                    serializer = self.get_serializer(new_file)
                    data = serializer.data
                    data['duplicate_detected'] = True
                    
                    headers = self.get_success_headers(serializer.data)
                    return Response(data, status=status.HTTP_201_CREATED, headers=headers)
                else:
                    # Handle new file case - first time this file is uploaded
                    # Create new file record in a retrying transaction
                    max_retries = 3
                    retry_count = 0
                    while retry_count < max_retries:
                        try:
                            with transaction.atomic():
                                new_file = File(
                                    file=file_obj,
                                    original_filename=file_obj.name,
                                    file_type=content_type,
                                    size=file_size,
                                    file_hash=file_hash,
                                    is_duplicate=False,
                                    version=highest_version + 1,
                                    reference_count=1  # Initialize with reference count of 1
                                )
                                new_file.save()
                                break  # Exit the retry loop on success
                        except OperationalError as e:
                            if "database is locked" in str(e).lower() and retry_count < max_retries - 1:
                                retry_count += 1
                                sleep_time = 0.5 * (2 ** retry_count)  # Exponential backoff
                                logger.warning(f"Database locked, retrying in {sleep_time} seconds (attempt {retry_count+1}/{max_retries})")
                                time.sleep(sleep_time)
                                continue
                            else:
                                logger.error(f"Failed to save file after {max_retries} attempts: {str(e)}")
                                return Response(
                                    {'error': f'Database is currently busy. Please try again in a moment.'},
                                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                                )
                    
                    serializer = self.get_serializer(new_file)
                    headers = self.get_success_headers(serializer.data)
                    return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
                    
            except Exception as e:
                logger.error(f"Unhandled exception in file upload: {str(e)}")
                return Response(
                    {'error': f'An unexpected error occurred during file upload: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        try:
            total_files = File.objects.count()
            unique_files = File.objects.filter(is_duplicate=False).count()
            duplicate_files = File.objects.filter(is_duplicate=True).count()
            
            # Use safer aggregation method to get total storage
            files_with_size = File.objects.filter(is_duplicate=False).exclude(size__isnull=True)
            total_storage = sum(f.size or 0 for f in files_with_size)
            
            # Safe calculation of storage saved
            try:
                storage_saved = sum(getattr(file, 'storage_saved', 0) for file in File.objects.filter(is_duplicate=False))
                storage_efficiency = (storage_saved / total_storage * 100) if total_storage > 0 else 0
            except Exception as e:
                logger.error(f"Error calculating storage statistics: {str(e)}")
                storage_saved = 0
                storage_efficiency = 0
            
            return Response({
                'total_files': total_files,
                'unique_files': unique_files,
                'duplicate_files': duplicate_files,
                'total_storage': total_storage,
                'storage_saved': storage_saved,
                'storage_efficiency': f"{storage_efficiency:.2f}%"
            })
        except Exception as e:
            logger.error(f"Error retrieving file stats: {str(e)}")
            return Response(
                {'error': f'Error retrieving file statistics: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )