import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("PaymentService");

type CreateCustomerOptions = {
  metadata?: Record<string, string>;
};

export const PaymentService = {
  async createCustomer(userId: string, options: CreateCustomerOptions = {}) {
    try {
      const user = await UserService.getById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const stripeCustomer = await stripe.customers.create({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
        metadata: { ...options.metadata, user_id: userId },
      });
      logger.info({ userId, stripeCustomerId: stripeCustomer.id }, "Created Stripe customer");
      await UserService.update(userId, { stripeId: stripeCustomer.id });
      return { id: stripeCustomer.id };
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, options } });
      logger.error({ userId, error }, "Failed to create Stripe customer");
      throw error;
    }
  },

  async createCourseCheckoutSession(userId: string, stripePriceId: string) {
    try {
      const success_url = new URL(
        "/purchase?success=true&session_id={CHECKOUT_SESSION_ID}",
        process.env.SITE_URL,
      ).toString();
      const cancel_url = new URL("/api/purchase?success=false", process.env.SITE_URL).toString();

      const user = await UserService.getById(userId);
      let stripeCustomerId = user?.stripeId ?? undefined;

      if (!user) {
        throw new Error("User not found");
      }

      if (!user.stripeId) {
        logger.info({ userId }, "Creating Stripe customer for user without stripeId");
        const customer = await this.createCustomer(user.id);
        stripeCustomerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "payment",
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url,
        cancel_url,
        metadata: {
          user_id: user.id,
        },
      });
      logger.info({ userId, stripePriceId, sessionId: session.id }, "Created course checkout session");
      return session;
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, stripePriceId } });
      logger.error({ userId, stripePriceId, error }, "Failed to create course checkout session");
      throw error;
    }
  },
};
