import { ApiError } from './client'

// Backend error codes (see internal/handlers/handlers.go) mapped to copy that
// says what happened and what to do next.
const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_request: "That request wasn't valid. Check the form and try again.",
  invalid_wine_id: "Couldn't find that wine. Go back to the cellar and try again.",
  invalid_meal_id: "Couldn't find that meal. Refresh the page and try again.",
  invalid_appellation_id: "Couldn't find that appellation. Refresh the page and try again.",
  invalid_producer_id: "Couldn't find that producer. Refresh the page and try again.",
  invalid_consumption_id: "Couldn't find that consumption entry. Refresh the page and try again.",
  already_exists: 'That name is already in use. Choose a different one.',
  invalid_color: 'Color must be rouge, blanc, or rose.',
  appellation_not_found: "That appellation doesn't exist anymore. Refresh the page and try again.",
  producer_not_found: "That producer doesn't exist anymore. Refresh the page and try again.",
  wine_not_found: "Couldn't find that wine. It may have been deleted — go back to the cellar and try again.",
  meal_not_found: "That meal doesn't exist anymore. Refresh the page and try again.",
  meal_in_use: "This meal is used in a meal pairing. Remove the pairing first, then delete the meal.",
  appellation_in_use:
    'This appellation is used by a wine or a meal pairing. Remove those references first, then delete the appellation.',
  producer_in_use:
    'This producer is used by a wine. Remove that reference first, then delete the producer.',
  date_required: 'Enter a date for this consumption.',
  invalid_date: 'Enter the date as YYYY-MM-DD.',
  invalid_rating: 'Rating must be between 1 and 5.',
  quantity_zero: "There's nothing left to log for this wine — update the quantity first.",
  initial_quantity_required: 'Enter an initial quantity of at least 1.',
  consumption_not_found: "That consumption entry doesn't exist anymore. Refresh the page and try again.",
  internal_error: 'Something went wrong on our end. Please try again.',
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

export function friendlyErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC_MESSAGE
  if (error.status === 0) return error.message
  return MESSAGES_BY_CODE[error.message] ?? GENERIC_MESSAGE
}
