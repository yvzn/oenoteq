# 04: Forms and management

**What to build:** the write side of the app in English and French: the add/edit wine form (including label-scan messages), the meal, appellation and producer list and form pages, and the meal pairing view. All form validation messages appear in the user's language, the pure validation functions stay testable by returning a message key plus parameters instead of English text.

**Blocked by:** 02 (Shell, sync surfaces and error messages)

**Status:** ready-for-agent

- [ ] Add/edit wine form: labels (Vintage/Millésime, Drinking window start/end, Quantity), placeholders, buttons, label-scan prompts and prefill messages, load-error and retry text, create-feedback text
- [ ] Wine form validators (garde end before start, initial quantity at least 1, and the others) return key + parameters; the view translates them; domain unit tests assert the key and parameters, not English text
- [ ] Meal, appellation and producer list and form pages, including delete confirmations, in-use messages and empty states, in both languages, with validators returning key + parameters
- [ ] Meal pairing view: appellation/color pickers, "add or create a meal" text and create feedback, empty and error states
- [ ] Color and Garde labels in forms use the same approved vocabulary as the other screens
- [ ] User-entered values are never altered by a language switch, and a half-filled form keeps its values when the language is switched
- [ ] Switching language updates mounted forms and validation messages already on screen
- [ ] Existing English tests pass unchanged; French smoke tests for the wine form (a validation error), each management area (list title/empty state) and the pairing view
- [ ] No API, schema or `api.http` change
