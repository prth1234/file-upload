from rest_framework import serializers
from .models import File

class FileSerializer(serializers.ModelSerializer):
    storage_saved = serializers.SerializerMethodField()
    duplicate_detected = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = File
        fields = [
            'id', 'file', 'original_filename', 'file_type', 'size', 
            'uploaded_at', 'file_hash', 'is_duplicate', 
            'original_file', 'reference_count', 'storage_saved',
            'version', 'duplicate_detected'
        ]
        read_only_fields = [
            'id', 'uploaded_at', 'file_hash', 'is_duplicate', 
            'original_file', 'reference_count', 'storage_saved',
            'version', 'duplicate_detected'
        ]
    
    def get_storage_saved(self, obj):
        return obj.storage_saved
    
    def get_duplicate_detected(self, obj):
        # This will be set in the view, but we need to include it in the serializer
        # to make it available in the API response
        return False