const { app } = require('@azure/functions');
const fetch = require('node-fetch');

const TARGET_CHARGE_POINTS = [10, 9, 8, 277];

app.http('ampecoWebhook', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {

        // 🔐 Security check via query parameter
        const url = new URL(request.url);
        const incomingSecret = url.searchParams.get("secret");

        if (incomingSecret !== process.env.WEBHOOK_SECRET) {
            context.log("❌ Unauthorized request");
            return {
                status: 401,
                body: "Unauthorized"
            };
        }

        const body = await request.json();

        context.log("🚀 FUNCTION RUNNING");
        context.log("Payload:", body);

        // 🔹 Filter charge points
        if (!TARGET_CHARGE_POINTS.includes(body.chargePointId)) {
            return { status: 200 };
        }

        context.log(`Processing chargePointId: ${body.chargePointId}`);

        try {
            // 🔹 Get access token ONCE
            const tokenResponse = await fetch(
                `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        client_id: process.env.CLIENT_ID,
                        client_secret: process.env.CLIENT_SECRET,
                        scope: "https://graph.microsoft.com/.default",
                        grant_type: "client_credentials"
                    })
                }
            );

            const tokenData = await tokenResponse.json();

            if (!tokenData.access_token) {
                context.log("❌ Failed to get token:", tokenData);
                return { status: 500 };
            }

            const accessToken = tokenData.access_token;

            // 🔋 FINISHED CHARGING (suspendedEV)
            if (body.hardwareStatus === "suspendedEV") {
                context.log("🔋 Charging finished - sending email");

                const emailResponse = await fetch(
                    "https://graph.microsoft.com/v1.0/users/kl.moore@enevi.com.au/sendMail",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            message: {
                                subject: "EVSE Charging Finished",
                                body: {
                                    contentType: "Text",
                                    content: `Hi,

The vehicle using charger with station EVSE number ${body.evseId} has now been suspended by the vehicle.

Thanks`
                                },
                                toRecipients: [
                                    {
                                        emailAddress: {
                                            address: "kl.moore@enevi.com.au"
                                        }
                                    }
                                ]
                            }
                        })
                    }
                );

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text();
                    context.log("❌ Graph ERROR (finished):", emailResponse.status, errorText);
                } else {
                    context.log("✅ Finished email sent");
                }
            }

            // ⚡ STARTED CHARGING
            if (body.hardwareStatus === "charging") {
                context.log("⚡ Charging started - sending email");

                const emailResponse = await fetch(
                    "https://graph.microsoft.com/v1.0/users/kl.moore@enevi.com.au/sendMail",
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            message: {
                                subject: "EVSE Charging Started",
                                body: {
                                    contentType: "Text",
                                    content: `Hi,

The vehicle using the charger with station EVSE number ${body.evseId} has started charging.

Thanks`
                                },
                                toRecipients: [
                                    {
                                        emailAddress: {
                                            address: "kl.moore@enevi.com.au"
                                        }
                                    }
                                ]
                            }
                        })
                    }
                );

                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text();
                    context.log("❌ Graph ERROR (charging):", emailResponse.status, errorText);
                } else {
                    context.log("✅ Charging email sent");
                }
            }

        } catch (error) {
            context.log("❌ Exception:", error);
        }

        return {
            status: 200,
            body: "Processed"
        };
    }
});