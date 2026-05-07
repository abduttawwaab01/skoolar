import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = body.event;

    // Handle payment success
    if (event === 'charge.success') {
      const metadata = body.data.metadata;
      const schoolId = metadata?.schoolId;
      const planId = metadata?.planId;
      const amount = body.data.amount;
      const reference = body.data.reference;
      const status = body.data.status;

      if (status === 'success' && schoolId && planId) {
        // Update school plan
        await db.school.update({
          where: { id: schoolId },
          data: {
            plan: planId,
            planId: planId,
          },
        });

        // Log payment for verification - super admin can verify in platform payments
        console.log(`Payment webhook received for school ${schoolId}: ${reference}, amount: ${amount}, plan: ${planId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}