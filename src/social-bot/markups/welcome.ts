export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `Hi @${userName},Welcome to Tiktok follower Tracker bot`,

    keyboard: [
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
