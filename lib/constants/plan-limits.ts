export const FREE_INVENTORY_LIMIT = 50
export const FREE_CATALOGUE_LIMIT = 30

export const SUBSCRIPTION_PLANS = ['free', 'pro'] as const
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]
