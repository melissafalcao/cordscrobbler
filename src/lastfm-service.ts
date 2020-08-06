import axios from 'axios';
import md5 from 'crypto-js/md5';
import getUnixTime from 'date-fns/getUnixTime';
import { Track } from './users-service';
import { PlaybackData } from './data-providing-service';

export class LastfmService {
    
    readonly apiRootUrl = 'https://ws.audioscrobbler.com/2.0'
    readonly userAgent = 'discord2lastfm/1.0.0'

    performRequest(params: URLSearchParams, type: 'get' | 'post', signed: boolean) {
      params.set('api_key', process.env.LASTFM_API_KEY)
      if (signed) {
        if (type === 'post') {
          throw new Error('SessionKeyNotProvidedOnRequest')
        }
        params.set('api_sig', this.getCallSignature(params))
      }

      params.set('format', 'json');

      if (type === 'get') {
        const url = `${this.apiRootUrl}/?${params.toString()}`;
        return axios.get(url, {headers: {'User-Agent': this.userAgent}});
      }

      if (type === 'post') {
        const body = {};
        for (const [key, value] of params) {
          body[key] = value;
        }
        return axios.post(this.apiRootUrl, body, {headers: {'User-Agent': this.userAgent}});
      }

    }

    async fetchRequestToken(): Promise<string> {
      const params = new URLSearchParams()
      params.set('method', 'auth.gettoken')
      let request;
      try {
        request = await this.performRequest(params, 'get', true);
      } catch (error) {
        if (error?.response?.data?.error === 11 && error?.response?.data?.error === 16) {
          throw new Error('LastfmServiceUnavailable')
        } else {
          throw new Error('LastfmRequestUnknownError')
        }
      }
      return request.data.token;
    }

    getUserLoginUrl(token: string): string {
        return `http://www.last.fm/api/auth/?api_key=${process.env.LASTFM_API_KEY}&token=${token}`
    }

    async getSession(token: string): Promise<LastfmSessionResponse> {
        const params = new URLSearchParams()
        params.set('method', 'auth.getsession')
        params.set('token', token)
        let request;
        try {
           request = await this.performRequest(params, 'get', true);
           console.log(request)
        } catch (error) {
            if (error?.response?.data?.error === 14) {
              throw new Error('LastfmTokenNotAuthorized')
            } if (error?.response?.data?.error === 11 && error?.response?.data?.error === 16) {
              throw new Error('LastfmServiceUnavailable')
            } else {
              throw new Error('LastfmRequestUnknownError')
            }
        }

        const userName = request.data.session.name;
        const sessionKey = request.data.session.key;

        return {
          sessionKey,
          userName
        };

    }

    async scrobble(tracks: Track[], playbacksData: PlaybackData[], sessionKey: string) {
      const params = new URLSearchParams()
      
      params.set('method', 'track.scrobble')

      for (const [i, track] of tracks.entries()) {
        params.set(`artist[${i}]`, track.artist);
        params.set(`track[${i}]`, track.name);
        params.set(`timestamp[${i}]`, getUnixTime(playbacksData[i].timestamp).toString())
        if (track.album) {
          params.set(`album[${i}]`, track.album)
        }
      }
      params.set(`sk`, sessionKey)

      await this.performRequest(params, 'post', true)

    }

    updateNowPlaying(track: Track, sessionKey: string, durationInMillis: number) {
      // TODO: Update now playing feature
    }

    getCallSignature(params: URLSearchParams) {
        // Based on the implementation of https://github.com/jammus/lastfm-node/blob/master/lib/lastfm/lastfm-request.js
        let signatureString = '';
        
        params.sort()

        for (const [key, value] of params) {
          if (key !== "format") {
            const copiedValue = typeof value !== "undefined" && value !== null ? value : "";
            signatureString += key + copiedValue;
          }
        }

        signatureString += process.env.LASTFM_SHARED_SECRET;
        return md5(signatureString);
    }

}

type LastfmSessionResponse = {
  sessionKey: string
  userName: string
}