export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `Hi @${userName},Welcome to social follower Tracker bot`,

    keyboard: [
      [
        {
          text: 'track X account 🐦',
          callback_data: JSON.stringify({
            command: '/trackX',
            language: 'twitter',
          }),
        },
        {
          text: 'view all tracked X account',
          callback_data: JSON.stringify({
            command: '/viewX',
            language: 'twitter',
          }),
        },
      ],
      [
        {
          text: 'track tiktok account 🎵',
          callback_data: JSON.stringify({
            command: '/trackTiktok',
            language: 'tiktok',
          }),
        },
        {
          text: 'view all tracked tiktok account',
          callback_data: JSON.stringify({
            command: '/viewTiktok',
            language: 'tiktok',
          }),
        },
      ],
    ],
  };
};
