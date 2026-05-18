import { Router } from 'express';

// Webhook route — reserved for future integrations (PayPal billing, etc.)
// Twilio SMS webhook removed: push notifications do not require inbound webhooks.
const router = Router();

export default router;
