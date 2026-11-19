export interface CommunityRow {
    value: string
    description: string
}

export interface CommunitySection {
    id: string
    title: string
    summary: string
    /** 表头：第一列名 / 第二列名 */
    columns: [string, string]
    rows: CommunityRow[]
    /** 说明区块，用等宽字体展示 */
    callout?: { title?: string; lines: [string, string][] }
    note?: string
}

export const communitySections: CommunitySection[] = [
    {
        id: 'internal',
        title: 'Internal',
        summary: 'Scope and route-origin tags used inside AS207529.',
        columns: ['Community', 'Description'],
        callout: {
            title: 'Scope',
            lines: [
                ['(207529, <999, 0)', 'Applies to all of our nodes'],
                ['(207529, <999, 1)', 'Applies to this node only']
            ]
        },
        rows: [
            { value: '(207529, <999, 0)', description: 'Community for all nodes' },
            { value: '(207529, <999, 1)', description: 'Community for this node only' },
            { value: '(207529, 1, *)', description: 'Do not send to iBGP' },
            { value: '(207529, 2, *)', description: 'Do not send to eBGP' },
            { value: '(207529, 3, *)', description: 'Do not send to kernel' },
            { value: '(207529, 4, *)', description: 'Send to kernel but mark unreachable' },
            { value: '(207529, 5, *)', description: 'Send to kernel but mark blackhole' },
            { value: '(207529, 101, *)', description: 'Allow bgp_local_pref' },
            { value: '(207529, 201, *)', description: 'Transit routes' },
            { value: '(207529, 202, *)', description: 'IXP route server routes' },
            { value: '(207529, 203, *)', description: 'Peer routes' },
            { value: '(207529, 204, *)', description: 'Customer routes' },
            { value: '(207529, 209, *)', description: 'iBGP routes' }
        ]
    },
    {
        id: 'control',
        title: 'Control',
        summary:
            'Combine an action digit (*) with a target selector to steer how your routes are announced.',
        columns: ['Selector', 'Description'],
        callout: {
            title: 'Actions — replace * with',
            lines: [
                ['0', 'Do not announce to target'],
                ['1', 'Prepend ×1 to target'],
                ['2', 'Prepend ×2 to target'],
                ['4', 'Prepend ×4 to target'],
                ['8', 'Prepend ×8 to target']
            ]
        },
        rows: [
            { value: '(207529, 1*00, 0)', description: 'Do action to everyone' },
            { value: '(207529, 1*01, asn)', description: "Don't do action to this ASN" },
            { value: '(207529, 1*02, asn)', description: 'Do action to this ASN' },
            { value: '(207529, 1*10, 0)', description: 'Do action to every region' },
            { value: '(207529, 1*11, region_code)', description: "Don't do action to this region" },
            { value: '(207529, 1*12, region_code)', description: 'Do action to this region' },
            {
                value: '(207529, 1019, 0)',
                description: 'Disable (asn, 1010, 0), (asn, 1011, local_region) as default value'
            },
            { value: '(207529, 1*20, 0)', description: 'Do action to every country' },
            { value: '(207529, 1*21, country_code)', description: "Don't do action to this country" },
            { value: '(207529, 1*22, country_code)', description: 'Do action to this country' },
            { value: '(207529, 1*30, 1)', description: 'Do action to upstreams' },
            { value: '(207529, 1*30, 2)', description: 'Do action to IXP route servers' },
            { value: '(207529, 1*30, 3)', description: 'Do action to peers' },
            { value: '(207529, 1*30, 4)', description: 'Do action to downstreams' },
            { value: '(207529, 1*30, 8)', description: 'Do action to route collectors' }
        ]
    },
    {
        id: 'informational',
        title: 'Informational',
        summary: 'Attached by us to describe where a route was learned.',
        columns: ['Community', 'Description'],
        rows: [
            { value: '(207529, 10000, region_code)', description: 'Received from region' },
            { value: '(207529, 10001, country_code)', description: 'Received from country' }
        ]
    },
    {
        id: 'regions',
        title: 'Region codes',
        summary: 'Values for region_code in control and informational communities.',
        columns: ['Code', 'Region'],
        rows: [
            { value: '41', description: 'Europe' },
            { value: '42', description: 'North America-East' },
            { value: '43', description: 'North America-Central' },
            { value: '44', description: 'North America-West' },
            { value: '45', description: 'Central America' },
            { value: '46', description: 'South America-Central' },
            { value: '47', description: 'South America-West' },
            { value: '48', description: 'Africa-N (above Sahara)' },
            { value: '49', description: 'Africa-S (below Sahara)' },
            { value: '50', description: 'Asia-S (IN, PK, BD)' },
            { value: '51', description: 'Asia-SE (TH, SG, PH, ID, MY)' },
            { value: '52', description: 'Asia-E (JP, KR, TW, HK, CN)' },
            { value: '53', description: 'Pacific & Oceania (AU, NZ, FJ)' },
            { value: '54', description: 'Antarctica' },
            { value: '55', description: 'Asia-N (RU)' },
            { value: '56', description: 'Asia-W (IR, TR, UAE)' },
            { value: '57', description: 'Central Asia (AF, UZ, KZ)' }
        ]
    },
    {
        id: 'countries',
        title: 'Country codes',
        summary: 'Values for country_code.',
        columns: ['Code', 'Country'],
        rows: [],
        note: 'country_code uses the ISO 3166-1 numeric-3 code, e.g. 276 for Germany, 392 for Japan.'
    }
]
