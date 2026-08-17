{clientSecret && (
  <div className="mt-4 min-h-[250px]">
    <h2 className="text-lg font-semibold mb-2 text-gray-800">
      Complete Your Payment (${chargeAmount})
    </h2>
    {/* Adding key={clientSecret} forces a clean Stripe instance reload */}
    <Elements key={clientSecret} stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm onSuccess={handleUserBPaymentSuccess} buttonText={`Pay $${chargeAmount} & Finalize Order`} />
    </Elements>
  </div>
)}