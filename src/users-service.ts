import { PlaybackData } from './data-providing-service';
import { LastfmService } from './lastfm-service';
import { User as DiscordUser, MessageCollector } from 'discord.js';

export class UsersService {
    private registeredUsers: RegisteredUser[];
    private registeringUsers: RegisteringUser[];
    private lastfmService: LastfmService

    constructor() {
        this.registeringUsers = [];
        this.registeredUsers = [];
        this.lastfmService = new LastfmService();
    }

    async startRegistrationProcess(discordUser: DiscordUser) {
                
        if (this.registeredUsers.find(x => x.discordUserId === discordUser.id)) {
            throw new Error('UserAlreadyRegistered')
        }

        if (this.registeringUsers.find(x => x.discordUserId === discordUser.id)) {
            throw new Error('UserAlreadyInRegistrationProcess')
        }
        
        const lastfmRequestToken = await this.lastfmService.fetchRequestToken();
        const registeringUser: RegisteringUser = {
            discordUserId: discordUser.id,
            discordUserName: discordUser.username,
            lastfmRequestToken
        }
        this.registeringUsers.push(registeringUser);
    }

    getRegistrationProcessLoginUrl(discordUser: DiscordUser): string {
        const registeringUser = this.registeringUsers.find(x => x.discordUserId === discordUser.id)

        if (!registeringUser) {
            throw new Error('UserNotInRegistrationProcess')
        }

        return this.lastfmService.getUserLoginUrl(registeringUser.lastfmRequestToken)
    } 

    cancelRegistrationProcess(discordUser: DiscordUser) {
        const registeringUser = this.registeringUsers.find(x => x.discordUserId === discordUser.id)
        this.removeUserIdFromRegisteringUsersArray(discordUser.id);
        registeringUser?.messageCollector?.stop();
    }

    async completeRegistrationProcess(discordUser: DiscordUser): Promise<RegisteredUser> {
        const registeringUser = this.registeringUsers.find(x => x.discordUserId === discordUser.id)
        try {
            const lastfmSessionResponse = await this.lastfmService.getSession(registeringUser.lastfmRequestToken)
            const registeredUser: RegisteredUser = {
                discordUserId: discordUser.id,
                discordUserName: discordUser.username,
                lastfmSessionKey: lastfmSessionResponse.sessionKey,
                lastfmUserName: lastfmSessionResponse.userName,
                isScrobbleOn: true
            };
            this.registeredUsers.push(registeredUser);
            return Object.create(registeredUser);

        } finally {
            this.removeUserIdFromRegisteringUsersArray(discordUser.id);
        }
    }

    isUserInRegistrationProcess(discordUser: DiscordUser): boolean {
        return this.registeringUsers.findIndex(x => x.discordUserId === discordUser.id) !== -1;
    }

    appendCollectorOnRegistrationProcess(discordUser: DiscordUser, messageCollector: MessageCollector) {
        const registeringUser = this.registeringUsers.find(x => x.discordUserId === discordUser.id)
        if (registeringUser) {
            registeringUser.messageCollector = messageCollector;
        }
    }

    private removeUserIdFromRegisteringUsersArray(userId: string) {
        const registeringUserIdIndex = this.registeringUsers.findIndex(x => x.discordUserId === userId);
        if (registeringUserIdIndex !== -1) {
            this.registeringUsers.splice(registeringUserIdIndex, 1);
        }
    }

    isUserRegistered(discordUser: DiscordUser) {
        return this.registeredUsers.findIndex(x => x.discordUserId === discordUser.id) !== -1;
    }

    getRegisteredUser(discordUser: DiscordUser): RegisteredUser {
        const registeredUser = this.registeredUsers.find(x => x.discordUserId === discordUser.id);
        if (!registeredUser) {
            throw new Error('UserNotRegistered')
        }
        return Object.create(registeredUser);
    }

    toggleScrobblingForUser(discordUser: DiscordUser, isScrobbledOn: boolean) {
        const user = this.registeredUsers.find(x => x.discordUserId === discordUser.id);
        if (!user) {
            throw new Error('UserNotRegistered')
        }
        user.isScrobbleOn = isScrobbledOn;
    }

    unregisterUser(discordUser) {
        const registeredUserIndex = this.registeredUsers.findIndex(x => x.discordUserId === discordUser.userId);
        
        if (registeredUserIndex === -1) {
            throw new Error('UserNotRegistered')
        }

        this.registeredUsers.splice(registeredUserIndex, 1);
    }

    addToScrobbleQueue(track: Track, playbackData: PlaybackData) {
    // TODO: Scrobble after 30s, cancel on songs shorter than 30s.
    }

    // TODO: What happens if the user revoked permissions? Can the bot send a DM to update tokens?
}

export type RegisteredUser = {
    discordUserId: string;
    discordUserName: string;
    lastfmUserName: string;
    lastfmSessionKey: string;
    isScrobbleOn: boolean;
};

export type RegisteringUser = {
    discordUserId: string;
    discordUserName: string;
    messageCollector?: MessageCollector;
    lastfmRequestToken: string;
}

export type Track = {
    artist: string;
    name: string;
    timestamp: string;
    album?: string;
};
