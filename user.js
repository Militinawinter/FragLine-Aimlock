// ==UserScript==
// @name         Fragline Admin - AimLock (Direct Packet Hook)
// @namespace    Militina
// @version      1.7.0
// @description  Instant AimLock via direct network input override for Fragline
// @author       Militina
// @match        *://beta.fragline.com/*
// @match        *://*.beta.fragline.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    let injected = false;

    function inject() {
        if (injected) return;
        injected = true;

        const script = document.createElement("script");

        script.textContent = `
        (() => {
            // =================================================
            // STATE
            // =================================================
            window.__MILITINA_AIM = {
                enabled: false,
                hooked: false,
                predictionTime: 0.5, // ปิด Prediction ไปก่อนเพื่อความตรงเป๊ะแบบ Realtime 100%
                lastAngle: null
            };

            // =================================================
            // PRESS START 2P FONT
            // =================================================
            const font = document.createElement("link");
            font.rel = "stylesheet";
            font.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
            document.head.appendChild(font);

            // =================================================
            // STATUS UI
            // =================================================
            const status = document.createElement("div");
            status.id = "militina-aim-status";
            Object.assign(status.style, {
                position: "fixed",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: "999999",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "16px",
                fontWeight: "normal",
                pointerEvents: "none",
                userSelect: "none",
                whiteSpace: "nowrap",
                display: "block"
            });
            status.textContent = "[OFF]";

            function addStatus() {
                if (document.documentElement && !document.documentElement.contains(status)) {
                    document.documentElement.appendChild(status);
                }
            }

            function updateStatus() {
                const state = window.__MILITINA_AIM;
                if (state.enabled) {
                    status.textContent = "[ON]";
                    status.style.color = "#00ff66";
                } else {
                    status.textContent = "[OFF]";
                    status.style.color = "#ff3333";
                }
                addStatus();
            }

            addStatus();

            // =================================================
            // INSTANT CALCULATE ANGLE
            // =================================================
            function getAimAngle() {
                try {
                    if (typeof app === "undefined" || !app.game || !app.game.manager) {
                        return null;
                    }

                    const manager = app.game.manager;
                    const local = manager.getLocalPlayer?.();

                    if (!local || !local.alive || !local.p || !Number.isFinite(local.p.x) || !Number.isFinite(local.p.y)) {
                        return null;
                    }

                    let best = null;
                    let bestDist = Infinity;
                    const list = Array.isArray(manager.playerList) ? manager.playerList : [];

                    for (let i = 0; i < list.length; i++) {
                        const id = list[i];
                        let player = null;
                        try {
                            player = manager.getPlayerById?.(id);
                        } catch {}

                        if (!player || player === local || !player.alive || !player.p) continue;

                        if (local.team !== undefined && player.team !== undefined && local.team === player.team) {
                            continue;
                        }

                        if (!Number.isFinite(player.p.x) || !Number.isFinite(player.p.y)) continue;

                        const dx = player.p.x - local.p.x;
                        const dy = player.p.y - local.p.y;
                        const dist = dx * dx + dy * dy;

                        if (dist < bestDist) {
                            bestDist = dist;
                            best = player;
                        }
                    }

                    if (!best) return null;

                    const dx = best.p.x - local.p.x;
                    const dy = best.p.y - local.p.y;

                    let angle = Math.atan2(dy, dx) + Math.PI;
                    if (angle > Math.PI) angle -= Math.PI * 2;

                    local.virtualFacing = angle;
                    return angle;

                } catch (err) {
                    return null;
                }
            }

            // =================================================
            // DIRECT HOOK TO GAME INPUT METHOD
            // =================================================
            function hookGameInput() {
                if (window.__MILITINA_AIM.hooked) return;

                const checkInterval = setInterval(() => {
                    if (typeof app !== "undefined" && app.game && app.game.input && app.game.input.updateFacing) {
                        clearInterval(checkInterval);

                        const originalUpdateFacing = app.game.input.updateFacing;

                        // เขียนทับฟังก์ชันการอัปเดตมุมมองของเกม
                        app.game.input.updateFacing = function (facingValue) {
                            const state = window.__MILITINA_AIM;

                            if (state.enabled) {
                                const angle = getAimAngle();
                                if (angle !== null) {
                                    // แปลงมุมมองตรงจุดที่เกมส่งแพ็กเกจทันที
                                    let encoded = Math.round((16383 / (Math.PI * 2)) * (angle + Math.PI));
                                    encoded &= 16383;

                                    // ส่งค่าที่เราล็อกไว้แทนค่าเมาส์ปกติของเกม
                                    return originalUpdateFacing.call(this, encoded);
                                }
                            }

                            return originalUpdateFacing.call(this, facingValue);
                        };

                        window.__MILITINA_AIM.hooked = true;
                        console.log("%c[AimLock] Input Direct Hook Active!", "color:#00ff66;font-weight:bold");
                    }
                }, 100);
            }

            // =================================================
            // TOGGLE
            // =================================================
            window.__MILITINA_AIM.toggle = function () {
                const state = window.__MILITINA_AIM;
                state.enabled = !state.enabled;

                if (state.enabled) {
                    console.log("%c[AimLock] Turned ON (Direct Netcode Hook)", "color:#59a6ff;font-weight:bold");
                    updateStatus();
                } else {
                    console.log("%c[AimLock] Turned OFF", "color:#ff7070;font-weight:bold");
                    updateStatus();
                }
            };

            // เริ่มทำการ Hook ทันทีที่โหลดสคริปต์
            hookGameInput();
            updateStatus();

            console.log("%c[AimLock v1.7.0] Loaded Successfully!", "color:#69a7ff;font-weight:bold");
        })();
        `;

        document.documentElement.appendChild(script);
        script.remove();
    }

    inject();

    // =================================================
    // KEYBIND: Y TO TOGGLE
    // =================================================
    window.addEventListener(
        "keydown",
        function (e) {
            if (e.repeat || e.key.toLowerCase() !== "y") return;

            const target = e.target;
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable
            ) {
                return;
            }

            if (window.__MILITINA_AIM?.toggle) {
                window.__MILITINA_AIM.toggle();
            }
        },
        true
    );

    console.log("%c[AimLock] Loaded! Press Y to Toggle", "color:#69a7ff;font-weight:bold");
})();
