export const menuMarkup = async () => {
  return {
    message: `Choose an option:`,

    keyboard: [
      [
        {
          text: 'track Instagram account 📸',
          callback_data: JSON.stringify({
            command: '/trackInsta',
            language: 'twitter',
          }),
        },
        {
          text: 'view all tracked Instagram account',
          callback_data: JSON.stringify({
            command: '/viewInsta',
            language: 'twitter',
          }),
        },
      ],
    ],
  };
};
