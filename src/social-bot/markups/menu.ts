export const menuMarkup = async () => {
  return {
    message: `Choose an option:`,

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
