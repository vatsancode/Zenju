import Razorpay from 'razorpay'

if (!process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('RAZORPAY_KEY_SECRET is not set in environment variables')
}

export const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})
