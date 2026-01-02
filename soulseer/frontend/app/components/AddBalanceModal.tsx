'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface AddBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BALANCE_OPTIONS = [
  { amount: 10, label: '$10', popular: false },
  { amount: 20, label: '$20', popular: false },
  { amount: 30, label: '$30', popular: true },
  { amount: 50, label: '$50', popular: false },
  { amount: 100, label: '$100', popular: false },
];

export default function AddBalanceModal({ isOpen, onClose, onSuccess }: AddBalanceModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create payment intent
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/add-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ amount: selectedAmount }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      const { clientSecret, paymentIntentId } = await response.json();

      // Initialize Stripe
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      // Confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: {
            // This would be replaced with actual card element
            token: 'tok_visa', // Test token
          },
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Confirm balance addition
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/confirm-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ paymentIntentId }),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="mystical-card max-w-md w-full p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-playfair text-3xl text-mystical-pink">Add Balance</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition text-2xl"
          >
            ×
          </button>
        </div>

        <p className="text-gray-300 mb-6">
          Select an amount to add to your account balance. This will be used for pay-per-minute readings.
        </p>

        {/* Balance Options */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {BALANCE_OPTIONS.map((option) => (
            <button
              key={option.amount}
              onClick={() => setSelectedAmount(option.amount)}
              className={`relative p-6 rounded-xl border-2 transition-all ${
                selectedAmount === option.amount
                  ? 'border-mystical-pink bg-mystical-pink/10'
                  : 'border-mystical-pink/30 hover:border-mystical-pink/60'
              }`}
            >
              {option.popular && (
                <span className="absolute -top-2 -right-2 bg-mystical-gold text-black text-xs px-2 py-1 rounded-full font-bold">
                  Popular
                </span>
              )}
              <div className="text-3xl font-bold text-white mb-1">{option.label}</div>
              <div className="text-sm text-gray-400">
                ~{Math.floor(option.amount / 3)} minutes at $3/min
              </div>
            </button>
          ))}
        </div>

        {/* Selected Amount Summary */}
        <div className="bg-black/40 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Amount to add:</span>
            <span className="text-2xl font-bold text-mystical-pink">${selectedAmount}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Estimated reading time:</span>
            <span className="text-mystical-gold">
              ~{Math.floor(selectedAmount / 3)}-{Math.floor(selectedAmount / 2)} minutes
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-full border-2 border-mystical-pink/50 text-white hover:border-mystical-pink transition"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAddBalance}
            className="flex-1 btn-mystical"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner w-5 h-5 border-2"></div>
                Processing...
              </span>
            ) : (
              `Add $${selectedAmount}`
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          Secure payment powered by Stripe. Your balance never expires.
        </p>
      </div>
    </div>
  );
}