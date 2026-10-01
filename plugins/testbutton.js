'use strict';

/**
 * Custom Buttons & Native Flow Test Suite
 * 
 * Provides interactive test cases (1 - 7) for all WhatsApp Native Flow button primitives:
 * - Case 1: Quick Reply Buttons (Instant Command Callbacks)
 * - Case 2: Call-to-Action Buttons (CTA URL & Copy Code to Clipboard)
 * - Case 3: Telephony Call Action Buttons
 * - Case 4: Hybrid Native Flow (All 4 Primitive Types Combined)
 * - Case 5: Single Select List Menu (Sections & Interactive Rows)
 * - Case 6: Multi-Row Grid Flow (5 Sequential Quick Replies)
 * - Case 7: Dynamic User-Generated Custom Buttons
 */

module.exports = {
    command: 'testbutton',
    aliases: ['testbtn', 'testbuttons', 'buttons', 'btn', 'custombutton', 'custombuttons'],
    category: 'tools',
    description: 'Test interactive WhatsApp native flow custom buttons (Cases 1 - 7)',
    usage: '.testbtn [1-7] | .testbtn 7 <title> | <text> | <btn1, btn2, ...>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        const subCommand = (args[0] || '').toLowerCase().trim();

        // Helper to dispatch native flow buttons reliably via sock.sendButtons or sock.sendMessage
        const dispatchButtons = async (payload) => {
            if (typeof sock.sendButtons === 'function') {
                return await sock.sendButtons(chatId, payload, message);
            }
            return await sock.sendMessage(chatId, payload, { quoted: message });
        };

        // ==========================================
        // TEST CASE 1: Standard Quick Replies
        // ==========================================
        if (subCommand === '1' || subCommand === 'quick' || subCommand === 'reply') {
            const payload = {
                title: '🔘 TEST CASE 1: QUICK REPLIES',
                subtitle: 'Interactive Command Callbacks',
                text: 'Tap any button below to trigger the command callback instantly:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'quick_reply',
                        text: '🏓 Ping Latency',
                        id: '.ping'
                    },
                    {
                        type: 'quick_reply',
                        text: '📊 System Status',
                        id: '.alive'
                    },
                    {
                        type: 'quick_reply',
                        text: '🤖 AI Mode Status',
                        id: '.aimode status'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 2: Call-to-Action (URL & Copy Code)
        // ==========================================
        if (subCommand === '2' || subCommand === 'cta' || subCommand === 'url' || subCommand === 'copy') {
            const payload = {
                title: '🌐 TEST CASE 2: ACTION BUTTONS (CTA)',
                subtitle: 'Deep-link URLs & Clipboard Copy',
                text: 'Test external web links and one-tap clipboard copy buttons:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'url',
                        text: '🌐 GitHub Repository',
                        url: 'https://github.com/pgwiz/PGWIZ-MD'
                    },
                    {
                        type: 'copy',
                        text: '📋 Copy Access Token',
                        copy_code: 'PGWIZ-SUPER-2026-VIP'
                    },
                    {
                        type: 'url',
                        text: '📢 Official Channel',
                        url: 'https://whatsapp.com/channel/0029VaFytMo4NVik2zJc1w1R'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 3: Direct Phone Call Button
        // ==========================================
        if (subCommand === '3' || subCommand === 'call' || subCommand === 'phone') {
            const payload = {
                title: '📞 TEST CASE 3: CALL ACTIONS',
                subtitle: 'Native Telephony Integration',
                text: 'Test native WhatsApp direct dialer integration button:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'call',
                        text: '📞 Call Helpdesk Support',
                        phone_number: '+254700000000'
                    },
                    {
                        type: 'quick_reply',
                        text: '💬 Contact Owner via Chat',
                        id: '.owner'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 4: Hybrid Native Flow (All 4 Primitives)
        // ==========================================
        if (subCommand === '4' || subCommand === 'hybrid' || subCommand === 'all') {
            const payload = {
                title: '⚡ TEST CASE 4: HYBRID NATIVE FLOW',
                subtitle: 'All 4 Button Primitives in One Payload',
                text: 'This message combines Quick Reply, URL link, Clipboard Copy, and Telephony Call:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'quick_reply',
                        text: '🔘 Quick Reply Test',
                        id: '.testbtn 1'
                    },
                    {
                        type: 'url',
                        text: '🌐 Open Web Portal',
                        url: 'https://github.com'
                    },
                    {
                        type: 'copy',
                        text: '📋 Copy Voucher Code',
                        copy_code: 'PROMO-2026-ROCKET'
                    },
                    {
                        type: 'call',
                        text: '📞 Emergency Hotline',
                        phone_number: '+18005550199'
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 5: Single Select List Menu
        // ==========================================
        if (subCommand === '5' || subCommand === 'list' || subCommand === 'select' || subCommand === 'menu') {
            const payload = {
                title: '📋 TEST CASE 5: INTERACTIVE LIST MENU',
                subtitle: 'Single-Select Dropdown with Categorized Sections',
                text: 'Tap the button below to open a multi-section interactive list menu with custom rows:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    {
                        type: 'single_select',
                        title: '📋 Open Options Menu',
                        sections: [
                            {
                                title: '⚡ Core Bot Commands',
                                rows: [
                                    {
                                        header: 'Latency Test',
                                        title: '🏓 Ping Bot',
                                        description: 'Measure real-time WebSocket round-trip ping',
                                        id: '.ping'
                                    },
                                    {
                                        header: 'Connection Health',
                                        title: '📡 Keepalive Status',
                                        description: 'Inspect active XMPP heartbeat & socket state',
                                        id: '.keepalive'
                                    },
                                    {
                                        header: 'Presence State',
                                        title: '🟢 Always Online Status',
                                        description: 'Inspect continuous companion online presence',
                                        id: '.alwaysonline'
                                    }
                                ]
                            },
                            {
                                title: '🎨 Media & Intelligence',
                                rows: [
                                    {
                                        header: 'HD Image Search',
                                        title: '🖼️ Search Images (Porsche)',
                                        description: 'Fetch 4 high-definition photos via Bing',
                                        id: '.gimg Porsche 911'
                                    },
                                    {
                                        header: 'Conversational AI',
                                        title: '🤖 AI Mode Overview',
                                        description: 'Configure conversational personas and reply modes',
                                        id: '.aimode'
                                    },
                                    {
                                        header: 'System Info',
                                        title: '📊 Bot Alive Stats',
                                        description: 'Show uptime, RAM usage, and version info',
                                        id: '.alive'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 6: Multi-Row Sequential Flow
        // ==========================================
        if (subCommand === '6' || subCommand === 'multi' || subCommand === 'grid') {
            const payload = {
                title: '🔢 TEST CASE 6: SEQUENTIAL BUTTON FLOW',
                subtitle: '5 Consecutive Quick Replies',
                text: 'Tests how WhatsApp renders multiple sequential quick reply buttons on your device:',
                footer: 'PGWIZ-MD • Native Flow Primitives',
                buttons: [
                    { type: 'quick_reply', text: '1️⃣ Test Case 1', id: '.testbtn 1' },
                    { type: 'quick_reply', text: '2️⃣ Test Case 2', id: '.testbtn 2' },
                    { type: 'quick_reply', text: '3️⃣ Test Case 3', id: '.testbtn 3' },
                    { type: 'quick_reply', text: '4️⃣ Test Case 4', id: '.testbtn 4' },
                    { type: 'quick_reply', text: '5️⃣ Test Case 5', id: '.testbtn 5' }
                ]
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // TEST CASE 7: Custom User-Defined Buttons
        // Syntax: .testbtn 7 <Title> | <Body> | <Btn1, Btn2, ...>
        // ==========================================
        if (subCommand === '7' || subCommand === 'custom') {
            const customQuery = args.slice(1).join(' ').trim();
            if (!customQuery || !customQuery.includes('|')) {
                return await sock.sendMessage(chatId, {
                    text: '⚙️ *Dynamic Custom Button Generator*\n\n' +
                          '*Format:*\n' +
                          '`.testbtn 7 <Title> | <Text Content> | <Button 1, Button 2, ...>`\n\n' +
                          '*Example:*\n' +
                          '`.testbtn 7 Welcome VIP | Choose your plan below: | Basic, Pro, Enterprise`'
                }, { quoted: message });
            }

            const parts = customQuery.split('|').map(s => s.trim());
            const customTitle = parts[0] || 'Custom Buttons';
            const customBody = parts[1] || 'Select an option:';
            const rawButtons = (parts[2] || '').split(',').map(s => s.trim()).filter(Boolean);

            if (rawButtons.length === 0) {
                return await sock.sendMessage(chatId, {
                    text: '❌ Please provide at least one button label separated by commas.\n\n*Example:* `.testbtn 7 Survey | Do you like it? | Yes, No, Maybe`'
                }, { quoted: message });
            }

            const buttons = rawButtons.slice(0, 5).map((label, idx) => ({
                type: 'quick_reply',
                text: label,
                id: label.startsWith('.') ? label : `.echo Selected: ${label}`
            }));

            const payload = {
                title: `✨ ${customTitle.toUpperCase()}`,
                text: customBody,
                footer: 'PGWIZ-MD • Dynamic Button Generator',
                buttons
            };
            return await dispatchButtons(payload);
        }

        // ==========================================
        // DEFAULT: Master Showcase & Interactive Launcher
        // ==========================================
        const showcaseText = `🎛️ *CUSTOM BUTTONS TEST SUITE*\n\n` +
            `Choose a test case below to inspect WhatsApp native flow buttons on your device:\n\n` +
            `• *Case 1:* \`.testbtn 1\` - Quick Reply Buttons (Instant Command Callbacks)\n` +
            `• *Case 2:* \`.testbtn 2\` - Action Buttons (CTA URL & Copy Code to Clipboard)\n` +
            `• *Case 3:* \`.testbtn 3\` - Telephony Call Action Buttons\n` +
            `• *Case 4:* \`.testbtn 4\` - Full Hybrid Native Flow (All 4 Button Types)\n` +
            `• *Case 5:* \`.testbtn 5\` - Single Select List Menu (Dropdown Sections & Rows)\n` +
            `• *Case 6:* \`.testbtn 6\` - Multi-Row Grid Flow (5 Sequential Buttons)\n` +
            `• *Case 7:* \`.testbtn 7\` - Dynamic User-Defined Custom Buttons\n\n` +
            `_Tap any button below to launch that test case immediately:_`;

        const masterPayload = {
            title: '🔘 NATIVE BUTTONS TEST SUITE',
            subtitle: 'WhatsApp Flow Primitives Showcase',
            text: showcaseText,
            footer: 'PGWIZ-MD • Native Flow Primitives Engine',
            buttons: [
                {
                    type: 'quick_reply',
                    text: '⚡ Case 1: Quick Replies',
                    id: '.testbtn 1'
                },
                {
                    type: 'quick_reply',
                    text: '🌐 Case 2: URL & Copy',
                    id: '.testbtn 2'
                },
                {
                    type: 'quick_reply',
                    text: '⚡ Case 4: Full Hybrid',
                    id: '.testbtn 4'
                },
                {
                    type: 'quick_reply',
                    text: '📋 Case 5: List Menu',
                    id: '.testbtn 5'
                }
            ]
        };

        return await dispatchButtons(masterPayload);
    }
};
