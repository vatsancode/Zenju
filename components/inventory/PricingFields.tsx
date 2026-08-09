'use client'

import styles from './PricingFields.module.css'

export type PricingFieldsValue = {
  purchase_cost: number | ''
  target_profit_percent: number | ''
  selling_price: number | ''
  // Whichever field the user last typed into directly "wins" — the other
  // two recompute to stay consistent with it. Defaults to 'target_profit',
  // the cost + markup -> price direction.
  pricing_driven_by: 'target_profit' | 'selling_price'
}

export function emptyPricingFields(): PricingFieldsValue {
  return { purchase_cost: '', target_profit_percent: '', selling_price: '', pricing_driven_by: 'target_profit' }
}

interface PricingFieldsProps {
  value: PricingFieldsValue
  onChange: (next: PricingFieldsValue) => void
  purchaseCostHint?: string
  targetProfitHint?: string
  sellingPriceHint?: string
}

// Purchase Cost, Target Profit %, and Selling Price are three views of the
// same math (price = cost * (1 + profit / 100)). Shared by the Add Product
// form and both Edit forms so the fields, styling, and two-way calc stay in
// exactly one place.
export default function PricingFields({
  value,
  onChange,
  purchaseCostHint,
  targetProfitHint,
  sellingPriceHint,
}: PricingFieldsProps) {
  return (
    <>
      <div className={styles.row}>
        <div className="form-group">
          <label className="form-label form-label--required">Purchase cost per unit</label>
          <div className="input-prefix input-prefix--compact">
            <span className="input-prefix__label">₹</span>
            <input
              className="input-prefix__input"
              type="number"
              min="0"
              placeholder="0"
              value={value.purchase_cost}
              onChange={e => {
                const cost = e.target.value === '' ? '' : Number(e.target.value)
                if (value.pricing_driven_by === 'selling_price') {
                  // Price is the fixed number here — recompute the markup to match the new cost.
                  const pct = cost !== '' && Number(cost) > 0 && value.selling_price !== ''
                    ? Math.round(((Number(value.selling_price) - Number(cost)) / Number(cost)) * 100)
                    : value.target_profit_percent
                  onChange({ ...value, purchase_cost: cost, target_profit_percent: pct })
                  return
                }
                const price = cost !== '' && value.target_profit_percent !== ''
                  ? Math.round(Number(cost) * (1 + Number(value.target_profit_percent) / 100))
                  : value.selling_price
                onChange({ ...value, purchase_cost: cost, selling_price: price })
              }}
            />
          </div>
          {purchaseCostHint && <span className="form-hint">{purchaseCostHint}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">
            Target profit % <span className="text-tertiary font-normal">(Optional)</span>
          </label>
          <input
            className="form-input"
            type="number"
            min="0"
            placeholder="e.g. 30"
            value={value.target_profit_percent}
            onChange={e => {
              const pct = e.target.value === '' ? '' : Number(e.target.value)
              onChange({
                ...value,
                target_profit_percent: pct,
                // Editing markup directly means it's driving the price again.
                pricing_driven_by: 'target_profit',
                selling_price: value.purchase_cost !== '' && pct !== ''
                  ? Math.round(Number(value.purchase_cost) * (1 + Number(pct) / 100))
                  : value.selling_price,
              })
            }}
          />
          {targetProfitHint && <span className="form-hint">{targetProfitHint}</span>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label form-label--required">Selling price</label>
        <div className="input-prefix input-prefix--compact">
          <span className="input-prefix__label">₹</span>
          <input
            className="input-prefix__input"
            type="number"
            min="0"
            placeholder="0"
            value={value.selling_price}
            onChange={e => {
              const price = e.target.value === '' ? '' : Number(e.target.value)
              const pct = value.purchase_cost !== '' && Number(value.purchase_cost) > 0 && price !== ''
                ? Math.round(((Number(price) - Number(value.purchase_cost)) / Number(value.purchase_cost)) * 100)
                : value.target_profit_percent
              onChange({ ...value, selling_price: price, pricing_driven_by: 'selling_price', target_profit_percent: pct })
            }}
          />
        </div>
        {sellingPriceHint && <span className="form-hint">{sellingPriceHint}</span>}
      </div>
    </>
  )
}
