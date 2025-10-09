declare module 'facebook-nodejs-business-sdk' {
  export class FacebookAdsApi {
    static init(accessToken: string): FacebookAdsApi;
  }

  export class AdAccount {
    constructor(id?: string);
    getAdAccounts(fields: string[]): Promise<any[]>;
    getCampaigns(fields: string[]): Promise<any[]>;
  }

  export class Campaign {
    constructor(id: string);
    getInsights(fields: string[], params?: any): Promise<any[]>;
    getAdSets(fields: string[]): Promise<any[]>;
  }

  export class AdSet {
    constructor(id: string);
    getAds(fields: string[]): Promise<any[]>;
  }

  export class Ad {
    constructor(id: string);
  }
}