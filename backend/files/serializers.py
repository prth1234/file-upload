from rest_framework import serializers
from .models import File

class FileSerializer(serializers.ModelSerializer):
    storage_saved = serializers.SerializerMethodField()
    
    class Meta:
        model = File
        fields = [
            'id', 'file', 'original_filename', 'file_type', 'size', 
            'uploaded_at', 'file_hash', 'is_duplicate', 
            'original_file', 'reference_count', 'storage_saved'
        ]
        read_only_fields = [
            'id', 'uploaded_at', 'file_hash', 'is_duplicate', 
            'original_file', 'reference_count', 'storage_saved'
        ]
    
    def get_storage_saved(self, obj):
        return obj.storage_saved