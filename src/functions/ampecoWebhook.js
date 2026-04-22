const { app } = require('@azure/functions');

// List of allowed charge points
const TARGET_CHARGE_POINTS = [10, 9, 8, 277];

app.http('ampecoWebhook', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const body = await request.json();

        context.log('Payload:', body);

        // 🔹 Filter by chargePointId
        if (!TARGET_CHARGE_POINTS.includes(body.chargePointId)) {
            context.log(`Ignoring chargePointId: ${body.chargePointId}`);
            return {
                status: 200,
                body: "Ignored"
            };
        }

        // ✅ Only allowed charge points reach here
        context.log(`Processing chargePointId: ${body.chargePointId}`);

        // 🔹 Optional: filter by status (example)
        if (body.hardwareStatus === "faulted") {
            context.log("⚠️ Fault detected!");
            // email logic will go here later
        }

        return {
            status: 200,
            body: "Processed"
        };
    }
});