from django.db import models
import uuid
import os
import hashlib
import io
from cryptography.fernet import Fernet

def file_upload_path(instance, filename):
    """Generate file path for new file upload"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('uploads', filename)

def compute_file_hash(file):
    """Compute SHA-256 hash of a file"""
    sha256 = hashlib.sha256()
    for chunk in file.chunks():
        sha256.update(chunk)
    return sha256.hexdigest()

# Store this key securely! For demo, you can hardcode, but use env vars in production.
FERNET_KEY = os.environ.get('FERNET_KEY', Fernet.generate_key())
fernet = Fernet(FERNET_KEY)

def encrypt_data(data: bytes) -> bytes:
    return fernet.encrypt(data)

def decrypt_data(data: bytes) -> bytes:
    return fernet.decrypt(data)

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
    
    # Field for versioning
    version = models.IntegerField(default=1)
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['file_type']),
            models.Index(fields=['size']),
            models.Index(fields=['uploaded_at']),
            models.Index(fields=['file_hash']),
            models.Index(fields=['is_duplicate']),
        ]
    
    def __str__(self):
        return f"{self.original_filename} (v{self.version})"
    
    def save(self, *args, **kwargs):
        # Hash the file before saving
        if self.file and not self.file_hash:
            self.file_hash = compute_file_hash(self.file)
        
        # Encrypt file before saving
        if self.file and not getattr(self, '_encrypted', False):
            self.file.seek(0)
            original_data = self.file.read()
            encrypted_data = encrypt_data(original_data)
            # Replace file content with encrypted data
            self.file.seek(0)
            self.file.file = io.BytesIO(encrypted_data)
            self.size = len(encrypted_data)
            self._encrypted = True  # Prevent double encryption

        super().save(*args, **kwargs)

    def get_decrypted_file(self):
        """Return decrypted file content as bytes"""
        self.file.seek(0)
        encrypted_data = self.file.read()
        return decrypt_data(encrypted_data)