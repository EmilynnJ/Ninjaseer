from django.contrib import admin
from django.utils.html import format_html
from .models import ReaderProfile, Product, VirtualGift
import requests
import os

@admin.register(ReaderProfile)
class ReaderProfileAdmin(admin.ModelAdmin):
    list_display = ['display_name', 'email', 'status_badge', 'average_rating', 'total_earnings', 'pending_payout', 'created_at']
    list_filter = ['status', 'is_active', 'created_at']
    search_fields = ['display_name', 'email', 'clerk_id']
    readonly_fields = ['clerk_id', 'total_earnings', 'pending_payout', 'average_rating', 'total_reviews', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('clerk_id', 'email', 'display_name', 'bio', 'profile_picture')
        }),
        ('Specialties & Services', {
            'fields': ('specialties',)
        }),
        ('Rates (per minute)', {
            'fields': ('chat_rate', 'call_rate', 'video_rate')
        }),
        ('Status', {
            'fields': ('status', 'is_online', 'is_active')
        }),
        ('Earnings & Payments', {
            'fields': ('total_earnings', 'pending_payout', 'stripe_account_id')
        }),
        ('Performance', {
            'fields': ('average_rating', 'total_reviews')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def status_badge(self, obj):
        colors = {
            'online': 'green',
            'offline': 'gray',
            'busy': 'orange'
        }
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.status.upper()
        )
    status_badge.short_description = 'Status'
    
    def save_model(self, request, obj, form, change):
        """Sync reader profile with Node.js backend"""
        super().save_model(request, obj, form, change)
        
        # Sync with backend API
        backend_url = os.getenv('BACKEND_API_URL', 'http://localhost:5000')
        try:
            if not change:  # New reader
                # Create user in backend
                response = requests.post(
                    f'{backend_url}/api/admin/readers',
                    json={
                        'clerk_id': obj.clerk_id,
                        'email': obj.email,
                        'display_name': obj.display_name,
                        'bio': obj.bio,
                        'specialties': obj.specialties,
                        'chat_rate': float(obj.chat_rate),
                        'call_rate': float(obj.call_rate),
                        'video_rate': float(obj.video_rate),
                    }
                )
                if response.status_code == 201:
                    print(f"Reader {obj.display_name} synced with backend")
        except Exception as e:
            print(f"Error syncing reader with backend: {e}")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'product_type', 'price', 'reader', 'inventory_count', 'is_active', 'created_at']
    list_filter = ['product_type', 'is_active', 'created_at']
    search_fields = ['name', 'description', 'stripe_product_id']
    readonly_fields = ['stripe_product_id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Product Information', {
            'fields': ('name', 'description', 'product_type', 'price')
        }),
        ('Association', {
            'fields': ('reader',)
        }),
        ('Inventory', {
            'fields': ('inventory_count', 'is_active')
        }),
        ('Stripe Integration', {
            'fields': ('stripe_product_id',)
        }),
        ('Media & Metadata', {
            'fields': ('images', 'metadata')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """Sync product with Stripe"""
        import stripe
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
        
        try:
            if not obj.stripe_product_id:
                # Create product in Stripe
                product = stripe.Product.create(
                    name=obj.name,
                    description=obj.description,
                )
                
                # Create price
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=int(obj.price * 100),
                    currency='usd',
                )
                
                obj.stripe_product_id = product.id
        except Exception as e:
            print(f"Error syncing with Stripe: {e}")
        
        super().save_model(request, obj, form, change)


@admin.register(VirtualGift)
class VirtualGiftAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    
    fieldsets = (
        ('Gift Information', {
            'fields': ('name', 'description', 'price')
        }),
        ('Media', {
            'fields': ('icon_url', 'animation_url')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )