from django.db import models
from django.contrib.auth.models import User

class ReaderProfile(models.Model):
    """Reader profile model for admin management"""
    
    # Basic Information
    clerk_id = models.CharField(max_length=255, unique=True)
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=255)
    bio = models.TextField(blank=True)
    profile_picture = models.ImageField(upload_to='reader_profiles/', blank=True, null=True)
    
    # Specialties
    SPECIALTY_CHOICES = [
        ('tarot', 'Tarot Reading'),
        ('astrology', 'Astrology'),
        ('mediumship', 'Mediumship'),
        ('numerology', 'Numerology'),
        ('palmistry', 'Palmistry'),
        ('crystals', 'Crystal Healing'),
        ('energy', 'Energy Reading'),
        ('dreams', 'Dream Interpretation'),
    ]
    specialties = models.JSONField(default=list)
    
    # Rates (per minute)
    chat_rate = models.DecimalField(max_digits=10, decimal_places=2, default=2.99)
    call_rate = models.DecimalField(max_digits=10, decimal_places=2, default=3.99)
    video_rate = models.DecimalField(max_digits=10, decimal_places=2, default=4.99)
    
    # Status
    STATUS_CHOICES = [
        ('online', 'Online'),
        ('offline', 'Offline'),
        ('busy', 'Busy'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='offline')
    is_online = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    # Earnings
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    pending_payout = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Stripe
    stripe_account_id = models.CharField(max_length=255, blank=True)
    
    # Ratings
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    total_reviews = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Reader Profile'
        verbose_name_plural = 'Reader Profiles'
    
    def __str__(self):
        return f"{self.display_name} ({self.email})"


class Product(models.Model):
    """Product model for shop management"""
    
    PRODUCT_TYPE_CHOICES = [
        ('service', 'Service'),
        ('digital', 'Digital Product'),
        ('physical', 'Physical Product'),
    ]
    
    stripe_product_id = models.CharField(max_length=255, unique=True, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField()
    product_type = models.CharField(max_length=50, choices=PRODUCT_TYPE_CHOICES)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    reader = models.ForeignKey(ReaderProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    inventory_count = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    images = models.JSONField(default=list)
    metadata = models.JSONField(default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
    
    def __str__(self):
        return self.name


class VirtualGift(models.Model):
    """Virtual gift model for live streams"""
    
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    icon_url = models.URLField(blank=True)
    animation_url = models.URLField(blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['price']
        verbose_name = 'Virtual Gift'
        verbose_name_plural = 'Virtual Gifts'
    
    def __str__(self):
        return f"{self.name} (${self.price})"