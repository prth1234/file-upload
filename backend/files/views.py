from django.shortcuts import render
from django.db.models import Q
from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.dateparse import parse_date
from .models import File, compute_file_hash
from .serializers import FileSerializer
from django.db import transaction

class FileViewSet(viewsets.ModelViewSet):
    queryset = File.objects.all()
    serializer_class = FileSerializer
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['original_filename']
    filterset_fields = ['file_type', 'is_duplicate']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by unique files only if specified
        show_unique_only = self.request.query_params.get('unique_only')
        if show_unique_only and show_unique_only.lower() == 'true':
            queryset = queryset.filter(is_duplicate=False)
        
        # Apply size range filter
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
        
        # Apply date range filter
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
        
        # Support for search parameter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(original_filename__icontains=search)
        
        # Support for file_type parameter as a list
        file_type = self.request.query_params.getlist('file_type')
        if file_type:
            # Check if hard filter is enabled
            hard_filter = self.request.query_params.get('hard_filter')
            if hard_filter and hard_filter.lower() == 'true':
                # Use exact match for file types
                queryset = queryset.filter(file_type__in=file_type)
            else:
                # Use contains match for file types (more flexible)
                file_type_filters = Q()
                for ft in file_type:
                    file_type_filters |= Q(file_type__icontains=ft)
                queryset = queryset.filter(file_type_filters)
            
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Need to save the file position so we can reset it later
        file_obj_position = file_obj.tell()
        
        # Compute file hash for deduplication
        file_hash = compute_file_hash(file_obj)
        
        # Reset file position after calculating hash
        file_obj.seek(file_obj_position)
        
        # Check if this file already exists (by hash)
        existing_file = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
        
        if existing_file:
            # This is a duplicate file
            # Increment the reference count on the original file
            existing_file.reference_count += 1
            existing_file.save()
            
            # Get the highest version of files with the same name
            highest_version = File.objects.filter(
                original_filename=file_obj.name
            ).order_by('-version').values_list('version', flat=True).first() or 0
            
            # Create a new file record that references the original file
            new_file = File(
                file=existing_file.file,  # Reuse the file path from original
                original_filename=file_obj.name,
                file_type=file_obj.content_type,
                size=file_obj.size,
                file_hash=file_hash,
                is_duplicate=True,
                original_file=existing_file,
                version=highest_version + 1  # Increment version for the same filename
            )
            new_file.save()
            
            serializer = self.get_serializer(new_file)
            data = serializer.data
            data['duplicate_detected'] = True
            
            headers = self.get_success_headers(serializer.data)
            return Response(data, status=status.HTTP_201_CREATED, headers=headers)
        else:
            # This is a new, unique file
            # Get the highest version of files with the same name
            highest_version = File.objects.filter(
                original_filename=file_obj.name
            ).order_by('-version').values_list('version', flat=True).first() or 0
            
            # Create a new file record
            new_file = File(
                file=file_obj,
                original_filename=file_obj.name,
                file_type=file_obj.content_type,
                size=file_obj.size,
                file_hash=file_hash,
                is_duplicate=False,
                version=highest_version + 1  # Increment version for the same filename
            )
            new_file.save()
            
            serializer = self.get_serializer(new_file)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return storage statistics"""
        total_files = File.objects.count()
        unique_files = File.objects.filter(is_duplicate=False).count()
        duplicate_files = File.objects.filter(is_duplicate=True).count()
        
        # Calculate total storage used (only count unique files)
        total_storage = sum(File.objects.filter(is_duplicate=False).values_list('size', flat=True)) or 0
        
        # Calculate storage saved through deduplication
        storage_saved = sum(file.storage_saved for file in File.objects.filter(is_duplicate=False))
        
        # Calculate storage efficiency
        storage_efficiency = (storage_saved / total_storage * 100) if total_storage > 0 else 0
        
        return Response({
            'total_files': total_files,
            'unique_files': unique_files,
            'duplicate_files': duplicate_files,
            'total_storage': total_storage,
            'storage_saved': storage_saved,
            'storage_efficiency': f"{storage_efficiency:.2f}%"
        })