/**
 * Invitation Service
 * Handles sending invitation emails via the backend.
 */
const InvitationService = {
    sendInvite: async (email, eventTitle, eventDate, link) => {
        if (!email || !link) {
            return { success: false, message: "Missing email or link." };
        }

        try {
            // Call the existing backend script
            const response = await fetch('../../backend/send_email.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: email,
                    eventTitle: eventTitle,
                    eventDate: eventDate,
                    link: link,
                    type: 'invitation' // Specify type to change email content
                })
            });

            return await response.json();
        } catch (error) {
            console.error("Invitation Email Error:", error);
            return { success: false, message: "Network error occurred." };
        }
    },

    saveConfig: async (eventId, config) => {
        try {
            const response = await fetch('../../backend/save_invitation_config.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event_id: eventId,
                    config: config
                })
            });
            return await response.json();
        } catch (error) {
            console.error("Save Config Error:", error);
            return { success: false, message: "Network error occurred." };
        }
    }
};

// Expose to window for use in inline scripts
window.InvitationService = InvitationService;