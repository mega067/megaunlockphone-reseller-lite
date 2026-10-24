class SessionManager {
    constructor() {
        this.orderSessions = {};
        this.addMoneySessions = {};
        this.ticketSessions = {};
        this.autoFundSessions = {};
        this.msgGrupSessions = {};
        this.busSessions = {};
        this.msgUserSessions = {};
        this.setPriceSessions = {};
        this.configTicketSessions = {};
        this.financeSessions = {};
    }

    clearSession(remoteJid) {
        let deleted = false;
        if (this.orderSessions[remoteJid]) { delete this.orderSessions[remoteJid]; deleted = true; }
        if (this.addMoneySessions[remoteJid]) { delete this.addMoneySessions[remoteJid]; deleted = true; }
        if (this.ticketSessions[remoteJid]) { delete this.ticketSessions[remoteJid]; deleted = true; }
        if (this.autoFundSessions[remoteJid]) { delete this.autoFundSessions[remoteJid]; deleted = true; }
        if (this.msgGrupSessions[remoteJid]) { delete this.msgGrupSessions[remoteJid]; deleted = true; }
        if (this.busSessions[remoteJid]) { delete this.busSessions[remoteJid]; deleted = true; }
        if (this.msgUserSessions[remoteJid]) { delete this.msgUserSessions[remoteJid]; deleted = true; }
        if (this.setPriceSessions[remoteJid]) { delete this.setPriceSessions[remoteJid]; deleted = true; }
        if (this.configTicketSessions[remoteJid]) { delete this.configTicketSessions[remoteJid]; deleted = true; }
        if (this.financeSessions && this.financeSessions[remoteJid]) { delete this.financeSessions[remoteJid]; deleted = true; }
        return deleted;
    }
}

module.exports = new SessionManager();
