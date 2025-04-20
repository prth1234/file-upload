from django.db import models
import uuid
import os
import hashlib

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)

def compute_file_hash(file):
    """Compute MD5 hash of a file"""
    md5 = hashlib.md5()
    for chunk in file.chunks():
        md5.update(chunk)
    return md5.hexdigest()

class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to=file_upload_path)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    size = models.BigIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    # Fields for deduplication
    file_hash = models.CharField(max_length=255, blank=True, null=True)
    is_duplicate = models.BooleanField(default=False)
    original_file = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='duplicates')
    reference_count = models.IntegerField(default=1)
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['file_type']),
            models.Index(fields=['size']),
            models.Index(fields=['uploaded_at']),
        ]
    
    def __str__(self):
        return self.original_filename
    
    @property
    def storage_saved(self):
        """Calculate storage saved if this is an original file with duplicates"""
        if not self.is_duplicate and self.reference_count > 1:
            return self.size * (self.reference_count - 1)
        return 0
