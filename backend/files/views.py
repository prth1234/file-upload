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
    filterset_fields = ['file_type']
    
    def get_queryset(self):
        queryset = File.objects.all()
        
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
        
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Compute file hash for deduplication
        file_hash = compute_file_hash(file_obj)
        
        # Check if this file already exists (by hash)
        existing_file = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
        
        if existing_file:
            # This is a duplicate file
            # Increment the reference count on the original file
            existing_file.reference_count += 1
            existing_file.save()
            
            # Create a new file record that references the original file
            data = {
                'file': existing_file.file,  # Reuse the file path from original
                'original_filename': file_obj.name,
                'file_type': file_obj.content_type,
                'size': file_obj.size,
                'file_hash': file_hash,
                'is_duplicate': True,
                'original_file': existing_file,
            }
            
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        else:
            # This is a new, unique file
            data = {
                'file': file_obj,
                'original_filename': file_obj.name,
                'file_type': file_obj.content_type,
                'size': file_obj.size,
                'file_hash': file_hash,
                'is_duplicate': False,
            }
            
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return storage statistics"""
        total_files = File.objects.count()
        unique_files = File.objects.filter(is_duplicate=False).count()
        duplicate_files = File.objects.filter(is_duplicate=True).count()
        
        # Calculate total storage and savings
        total_storage = File.objects.filter(is_duplicate=False).values_list('size', flat=True)
        total_storage = sum(total_storage) if total_storage else 0
        
        # Calculate storage saved
        storage_saved = 0
        for file in File.objects.filter(is_duplicate=False, reference_count__gt=1):
            storage_saved += file.size * (file.reference_count - 1)
        
        return Response({
            'total_files': total_files,
            'unique_files': unique_files,
            'duplicate_files': duplicate_files,
            'total_storage': total_storage,
            'storage_saved': storage_saved,
            'storage_efficiency': f"{(storage_saved / total_storage * 100):.2f}%" if total_storage > 0 else "0%"
        })