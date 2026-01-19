'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';

interface BalanceOption {
  amount: number;
  label: string;
  bonus: number;
  bonusLabel?: string;
  popular?: boolean;
}

interface AddBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onSuccess?: (newBalance: number) => void;
}

const balanceOptions: BalanceOption[] = [
  { amount: 10, label: '$10', bonus: 0 },
  { amount: 20, label: '$20', bonus: 0 },
  { amount: 30, label: '$30', bonus: 0, popular: true },
  { amount: 50, label: '$50', bonus: 2.50, bonusLabel: '+$2.50 bonus' },
  { amount: 100, label: '$100', bonus: 10, bonusLabel: '+$10 bonus' }
];

const PaymentMethodSelector = ({
  selected,
  onSelect
}: {
  selected: string;
  onSelect: (method: string) => void;
}) => {
  const methods = [
    { id: 'card', label: 'Credit/Debit Card', icon: '💳', description: 'Visa, Mastercard, Amex' },
    { id: 'paypal', label: 'PayPal', icon: '🅿️', description: 'Pay with PayPal balance', disabled: true },
    { id: 'apple', label: 'Apple Pay', icon: '🍎', description: 'Quick checkout', disabled: true }
  ];

  return (
    <div className="space-y-2">
      <label className="block text-gray-400 text-sm mb-2">Payment Method</label>
      {methods.map((method) => (
        <button
          key={method.id}
          onClick={() => !method.disabled && onSelect(method.id)}
          disabled={method.disabled}
          className={`w-full p-3 rounded-xl border transition-colors flex items-center gap-3 ${
            selected === method.id
              ? 'border-pink-500 bg-pink-500/10'
              : method.disabled
                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <span className="text-2xl">{method.icon}</span>
          <div className="text-left flex-1">
            <p className={`font-medium ${selected === method.id ? 'text-pink-400' : 'text-white'}`}>
              {method.label}
            </p>
            <p className="text-gray-500 text-sm">{method.description}</p>
          </div>
          {selected === method.id && (
            <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {method.disabled && (
            <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">Coming Soon</span>
          )}
        </button>
      ))}
    </div>
  );
};

const CardForm = ({
  onSubmit,
  isProcessing
}: {
  onSubmit: (cardDetails: any) => void;
  isProcessing: boolean;
}) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const getCardType = (number: string) => {
    const cleanNumber = number.replace(/\s/g, '');
    if (/^4/.test(cleanNumber)) return 'visa';
    if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
    if (/^3[47]/.test(cleanNumber)) return 'amex';
    if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
    return null;
  };

  const cardType = getCardType(cardNumber);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    const cleanCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanCardNumber.length < 15 || cleanCardNumber.length > 16) {
      newErrors.cardNumber = 'Invalid card number';
    }
    
    const [month, year] = expiry.split('/');
    if (!month || !year || parseInt(month) > 12 || parseInt(month) < 1) {
      newErrors.expiry = 'Invalid expiry date';
    }
    
    if (cvc.length < 3 || cvc.length > 4) {
      newErrors.cvc = 'Invalid CVC';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({ cardNumber, expiry, cvc, name });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cardholder Name */}
      <div>
        <label className="block text-gray-400 text-sm mb-2">Cardholder Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none ${
            errors.name ? 'border-red-500' : 'border-gray-700 focus:border-pink-500'
          }`}
        />
        {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-gray-400 text-sm mb-2">Card Number</label>
        <div className="relative">
          <input
            type="text"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className={`w-full px-4 py-3 pr-12 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none ${
              errors.cardNumber ? 'border-red-500' : 'border-gray-700 focus:border-pink-500'
            }`}
          />
          {cardType && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {cardType === 'visa' && <span className="text-blue-400 font-bold text-sm">VISA</span>}
              {cardType === 'mastercard' && <span className="text-orange-400 font-bold text-sm">MC</span>}
              {cardType === 'amex' && <span className="text-blue-300 font-bold text-sm">AMEX</span>}
              {cardType === 'discover' && <span className="text-orange-300 font-bold text-sm">DISC</span>}
            </div>
          )}
        </div>
        {errors.cardNumber && <p className="text-red-400 text-sm mt-1">{errors.cardNumber}</p>}
      </div>

      {/* Expiry and CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-400 text-sm mb-2">Expiry Date</label>
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            placeholder="MM/YY"
            maxLength={5}
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none ${
              errors.expiry ? 'border-red-500' : 'border-gray-700 focus:border-pink-500'
            }`}
          />
          {errors.expiry && <p className="text-red-400 text-sm mt-1">{errors.expiry}</p>}
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-2">CVC</label>
          <input
            type="text"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            maxLength={4}
            className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none ${
              errors.cvc ? 'border-red-500' : 'border-gray-700 focus:border-pink-500'
            }`}
          />
          {errors.cvc && <p className="text-red-400 text-sm mt-1">{errors.cvc}</p>}
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Your payment info is secure and encrypted</span>
      </div>

      <button
        type="submit"
        disabled={isProcessing}
        className={`w-full py-4 font-semibold rounded-full transition-colors ${
          isProcessing
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-pink-500 text-white hover:bg-pink-600'
        }`}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          'Complete Payment'
        )}
      </button>
    </form>
  );
};

const SuccessScreen = ({
  amount,
  bonus,
  newBalance,
  onClose
}: {
  amount: number;
  bonus: number;
  newBalance: number;
  onClose: () => void;
}) => {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      
      <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
      <p className="text-gray-400 mb-6">Your balance has been updated</p>
      
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400">Amount Added</span>
          <span className="text-white font-medium">${amount.toFixed(2)}</span>
        </div>
        {bonus > 0 && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Bonus</span>
            <span className="text-green-400 font-medium">+${bonus.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-gray-700 pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">New Balance</span>
            <span className="text-xl font-bold text-pink-400">${newBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <button
        onClick={onClose}
        className="w-full py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-colors"
      >
        Done
      </button>
    </div>
  );
};

export default function AddBalanceModal({ isOpen, onClose, currentBalance, onSuccess }: AddBalanceModalProps) {
  const [step, setStep] = useState<'select' | 'payment' | 'success'>('select');
  const [selectedAmount, setSelectedAmount] = useState<BalanceOption | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newBalance, setNewBalance] = useState(currentBalance);

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedAmount(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleSelectAmount = (option: BalanceOption) => {
    setSelectedAmount(option);
  };

  const handleContinueToPayment = () => {
    if (selectedAmount) {
      setStep('payment');
    }
  };

  const handlePayment = async (cardDetails: any) => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (selectedAmount) {
      const totalAdded = selectedAmount.amount + selectedAmount.bonus;
      const updatedBalance = currentBalance + totalAdded;
      setNewBalance(updatedBalance);
      setStep('success');
      onSuccess?.(updatedBalance);
    }
    
    setIsProcessing(false);
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setStep('select');
      setSelectedAmount(null);
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={step !== 'success' ? handleClose : undefined}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
        {/* Header */}
        {step !== 'success' && (
          <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-800 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              {step === 'payment' && (
                <button
                  onClick={() => setStep('select')}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 className="text-xl font-bold text-white">
                {step === 'select' ? 'Add Funds' : 'Payment Details'}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          {step === 'select' && (
            <>
              {/* Current Balance */}
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl p-4 mb-6 border border-pink-500/30">
                <p className="text-gray-400 text-sm mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-white">${currentBalance.toFixed(2)}</p>
              </div>

              {/* Amount Options */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-3">Select Amount</label>
                <div className="grid grid-cols-2 gap-3">
                  {balanceOptions.map((option) => (
                    <button
                      key={option.amount}
                      onClick={() => handleSelectAmount(option)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        selectedAmount?.amount === option.amount
                          ? 'border-pink-500 bg-pink-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {option.popular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full">
                          Popular
                        </span>
                      )}
                      <p className={`text-2xl font-bold ${
                        selectedAmount?.amount === option.amount ? 'text-pink-400' : 'text-white'
                      }`}>
                        {option.label}
                      </p>
                      {option.bonusLabel && (
                        <p className="text-green-400 text-sm mt-1">{option.bonusLabel}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {selectedAmount && (
                <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-white">${selectedAmount.amount.toFixed(2)}</span>
                  </div>
                  {selectedAmount.bonus > 0 && (
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Bonus</span>
                      <span className="text-green-400">+${selectedAmount.bonus.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">New Balance</span>
                      <span className="text-lg font-bold text-pink-400">
                        ${(currentBalance + selectedAmount.amount + selectedAmount.bonus).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Continue Button */}
              <button
                onClick={handleContinueToPayment}
                disabled={!selectedAmount}
                className={`w-full py-4 font-semibold rounded-full transition-colors ${
                  selectedAmount
                    ? 'bg-pink-500 text-white hover:bg-pink-600'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continue to Payment
              </button>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-6 text-gray-500 text-sm">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Secure
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Protected
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Instant
                </span>
              </div>
            </>
          )}

          {step === 'payment' && selectedAmount && (
            <>
              {/* Order Summary */}
              <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total</span>
                  <span className="text-xl font-bold text-white">${selectedAmount.amount.toFixed(2)}</span>
                </div>
                {selectedAmount.bonus > 0 && (
                  <p className="text-green-400 text-sm text-right">+${selectedAmount.bonus.toFixed(2)} bonus</p>
                )}
              </div>

              {/* Payment Method */}
              <div className="mb-6">
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                />
              </div>

              {/* Card Form */}
              {paymentMethod === 'card' && (
                <CardForm
                  onSubmit={handlePayment}
                  isProcessing={isProcessing}
                />
              )}
            </>
          )}

          {step === 'success' && selectedAmount && (
            <SuccessScreen
              amount={selectedAmount.amount}
              bonus={selectedAmount.bonus}
              newBalance={newBalance}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}