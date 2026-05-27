import { z } from 'zod';

export const SHARE_RANGES = ['nickname-only', 'nickname-ohaeng', 'nickname-gender'] as const;
export const SHARE_CHANNELS = ['kakao', 'web_share', 'instagram', 'copy_link'] as const;
export const REWARD_CHANNELS = ['kakao'] as const;

export const ShareRangeSchema = z.enum(SHARE_RANGES);
export const ShareChannelSchema = z.enum(SHARE_CHANNELS);
export const RewardChannelSchema = z.enum(REWARD_CHANNELS);

export type ShareRange = (typeof SHARE_RANGES)[number];
export type ShareChannel = (typeof SHARE_CHANNELS)[number];
export type RewardChannel = (typeof REWARD_CHANNELS)[number];
