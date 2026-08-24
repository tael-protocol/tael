"use client";

import { ChannelConnectClient } from "./channel-connect-client";
import type { CardPickerOption } from "../agents/queries";

/** Discord-specific wrapper around the shared channel connect UI. */
export function DiscordConnectClient(props: {
  token: string;
  productName: string;
  signedIn: boolean;
  walletAddress: string | null;
  cards: CardPickerOption[];
}) {
  return <ChannelConnectClient channel="discord" {...props} />;
}
