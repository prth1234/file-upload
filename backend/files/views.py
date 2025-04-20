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
        
        file_types = []
        
        file_type_list = self.request.query_params.getlist('file_type')
        if file_type_list:
            file_types.extend(file_type_list)
        
        file_type_array = self.request.query_params.getlist('file_type[]')
        if file_type_array:
            file_types.extend(file_type_array)
        
        if file_types:
            file_type_q = Q()
            for ft in file_types:
                if '/' in ft:
                    subtype = ft.split('/')[-1]
                    file_type_q |= Q(file_type__icontains=subtype)
                else:
                    file_type_q |= Q(file_type__icontains=ft)
            queryset = queryset.filter(file_type_q)
        
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        file_obj_position = file_obj.tell()
        
        file_hash = compute_file_hash(file_obj)
        
        file_obj.seek(file_obj_position)
        
        existing_file = File.objects.filter(file_hash=file_hash, is_duplicate=False).first()
        
        if existing_file:
            existing_file.reference_count += 1
            existing_file.save()
            
            highest_version = File.objects.filter(
                original_filename=file_obj.name
            ).order_by('-version').values_list('version', flat=True).first() or 0
            
            new_file = File(
                file=existing_file.file,
                original_filename=file_obj.name,
                file_type=file_obj.content_type,
                size=file_obj.size,
                file_hash=file_hash,
                is_duplicate=True,
                original_file=existing_file,
                version=highest_version + 1
            )
            new_file.save()
            
            serializer = self.get_serializer(new_file)
            data = serializer.data
            data['duplicate_detected'] = True
            
            headers = self.get_success_headers(serializer.data)
            return Response(data, status=status.HTTP_201_CREATED, headers=headers)
        else:
            highest_version = File.objects.filter(
                original_filename=file_obj.name
            ).order_by('-version').values_list('version', flat=True).first() or 0
            
            new_file = File(
                file=file_obj,
                original_filename=file_obj.name,
                file_type=file_obj.content_type,
                size=file_obj.size,
                file_hash=file_hash,
                is_duplicate=False,
                version=highest_version + 1
            )
            new_file.save()
            
            serializer = self.get_serializer(new_file)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        total_files = File.objects.count()
        unique_files = File.objects.filter(is_duplicate=False).count()
        duplicate_files = File.objects.filter(is_duplicate=True).count()
        
        total_storage = sum(File.objects.filter(is_duplicate=False).values_list('size', flat=True)) or 0
        
        storage_saved = sum(file.storage_saved for file in File.objects.filter(is_duplicate=False))
        
        storage_efficiency = (storage_saved / total_storage * 100) if total_storage > 0 else 0
        
        return Response({
            'total_files': total_files,
            'unique_files': unique_files,
            'duplicate_files': duplicate_files,
            'total_storage': total_storage,
            'storage_saved': storage_saved,
            'storage_efficiency': f"{storage_efficiency:.2f}%"
        })