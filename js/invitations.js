/**
 * Invitation Service
 * Handles sending invitation emails via the backend.
 * MODIFIED: Uses MockDB and EmailJS to avoid backend calls and CORS issues.
 */

const InvitationService = {
    sendInvite: async (email, eventTitle, eventDate, link) => {
        if (!email || !link) {
            return { success: false, message: "Missing email or link." };
        }

        // Use EmailJS directly, bypassing the PHP backend
        if (typeof emailjs === 'undefined' || typeof MockDB === 'undefined') {
            console.error('EmailJS SDK or MockDB not loaded.');
            return { success: false, message: 'A required library (EmailJS or MockDB) is not loaded.' };
        }

        // These parameters should match the variables used in your EmailJS template.
        // This is based on the template used in dashboard.js (template_5i46vh8).
        const templateParams = {
            to_email: email,
            event_name: eventTitle,
            event_date: eventDate,
            invitation_link: link, // You might need to add {{invitation_link}} to your template
            // Providing other potential variables the template might use
            attendee_name: "Valued Guest",
            qr_code_url: MockDB.generateQRCodeUrl(link) // Generate a QR code for the invitation link
        };

        try {
            // Using Service ID and Template ID from dashboard.js
            const response = await emailjs.send("service_ryl56ps", "template_5i46vh8", templateParams);
            console.log('EmailJS Success:', response);
            return { success: true, message: 'Invitation sent successfully via EmailJS.' };
        } catch (error) {
            console.error("EmailJS Send Error:", error);
            return { success: false, message: `Failed to send email via EmailJS.` };
        }
    },

    saveConfig: async (eventId, config) => {
        return new Promise((resolve, reject) => {
            try {
                // Use MockDB to save the configuration locally
                if (typeof MockDB === 'undefined') {
                    throw new Error("MockDB is not available.");
                }
                MockDB.updateEvent(eventId, { invitation_config: config });
                console.log(`Invitation config saved to MockDB for event ${eventId}`);
                resolve({ success: true, message: 'Configuration saved locally.' });
            } catch (error) {
                console.error("Save Config Error (MockDB):", error);
                // The original function returned a success:false object on error, so we do the same.
                resolve({ success: false, message: "Error saving configuration to local DB." });
            }
        });
    }
};

// Expose to window for use in inline scripts
window.InvitationService = InvitationService;