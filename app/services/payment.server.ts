import { createLogger } from "~/integrations/logger.server";
import { Sentry } from "~/integrations/sentry";
import { stripe } from "~/integrations/stripe.server";
import { AuthService } from "~/services/auth.server";
import { UserService } from "~/services/user.server";

const logger = createLogger("PaymentService");

type CreateCustomerOptions = {
  metadata?: Record<string, string>;
};

type CreateCourseCheckoutSessionArgs = {
  userId: string;
  stripePriceId: string;
  baseUrl: string;
};

export const PaymentService = {
  async createCustomer(userId: string, options: CreateCustomerOptions = {}) {
    try {
      const user = await UserService.getById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Validate userId format (Clerk user IDs are alphanumeric with underscores)
      if (!/^[a-zA-Z0-9_]+$/.test(userId)) {
        throw new Error("Invalid user ID format");
      }

      // Check if a Stripe customer already exists for this user
      const existingCustomers = await stripe.customers.search({
        query: `metadata["user_id"]:"${userId}"`,
      });

      if (existingCustomers.data.length > 0) {
        const existingCustomer = existingCustomers.data[0];
        logger.info(`Found existing Stripe customer ${existingCustomer.id} for user ${userId}`);

        // Log warning if multiple customers found (data inconsistency)
        if (existingCustomers.data.length > 1) {
          logger.warn(`Multiple Stripe customers found for user ${userId}`, {
            customerIds: existingCustomers.data.map((c) => c.id),
          });
          Sentry.captureMessage(`Multiple Stripe customers found for user ${userId}`, {
            level: "warning",
            extra: { userId, customerIds: existingCustomers.data.map((c) => c.id) },
          });
        }

        // Update Clerk metadata if not already set
        if (!user.publicMetadata.stripeCustomerId) {
          await AuthService.updatePublicMetadata(userId, { stripeCustomerId: existingCustomer.id });
        }
        return { id: existingCustomer.id };
      }

      const stripeCustomer = await stripe.customers.create(
        {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phone,
          // Ensure user_id is set last and cannot be overwritten by options.metadata
          metadata: { ...options.metadata, user_id: userId },
        },
        {
          // Use userId as idempotency key to prevent duplicate customers from race conditions
          idempotencyKey: `customer_create_${userId}`,
        },
      );
      logger.info(`Created Stripe customer ${stripeCustomer.id} for user ${userId}`);
      await AuthService.updatePublicMetadata(userId, { stripeCustomerId: stripeCustomer.id });
      return { id: stripeCustomer.id };
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, options } });
      logger.error(`Failed to create Stripe customer for user ${userId}`, { error });
      throw error;
    }
  },

  async createCourseCheckoutSession({ userId, stripePriceId, baseUrl }: CreateCourseCheckoutSessionArgs) {
    try {
      const success_url = new URL("/api/purchase?success=true&session_id={CHECKOUT_SESSION_ID}", baseUrl).toString();
      const cancel_url = new URL("/api/purchase?success=false", baseUrl).toString();

      const user = await UserService.getById(userId);
      let stripeCustomerId = user?.publicMetadata.stripeCustomerId;

      if (!user) {
        throw new Error("User not found");
      }

      if (!stripeCustomerId) {
        logger.info(`Creating Stripe customer for user ${userId} without stripeCustomerId`);
        const customer = await this.createCustomer(user.id);
        stripeCustomerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create(
        {
          customer: stripeCustomerId,
          mode: "payment",
          line_items: [{ price: stripePriceId, quantity: 1 }],
          success_url,
          cancel_url,
          metadata: {
            user_id: user.id,
          },
        },
        {
          // Use deterministic idempotency key based on user and price to prevent duplicate sessions
          // from double-clicks. Stripe retains idempotency keys for 24 hours, which is sufficient
          // to prevent accidental duplicates while still allowing intentional re-purchases.
          idempotencyKey: `checkout_session_${user.id}_${stripePriceId}`,
        },
      );
      logger.info(`Created course checkout session ${session.id} for user ${userId} with price ${stripePriceId}`);
      return session;
    } catch (error) {
      Sentry.captureException(error, { extra: { userId, stripePriceId } });
      logger.error(`Failed to create course checkout session for user ${userId} with price ${stripePriceId}`, {
        error,
      });
      throw error;
    }
  },
};
