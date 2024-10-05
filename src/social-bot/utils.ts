export async function twitterRemoveTrackerChatIdOrDelete(
  username: string,
  chatId: number,
) {
  try {
    // Find the document by twitterAccount
    const account = await this.TwitterAccountModel.findOne({
      twitterAccount: username.slice(1),
    });

    if (account) {
      const { trackerChatIds } = account;

      // Check if trackerChatId exists in the array
      if (trackerChatIds.includes(chatId)) {
        if (trackerChatIds.length > 1) {
          // If there are multiple trackerChatIds, remove the specific chatId
          return await this.TwitterAccountModel.findOneAndUpdate(
            { twitterAccount: username.slice(1) },
            { $pull: { trackerChatIds: chatId } },
          );
        } else {
          // If it's the only trackerChatId, delete the document
          return await this.TwitterAccountModel.findOneAndDelete({
            twitterAccount: username.slice(1),
          });
        }
        console.log('Tracker chat ID removed or account deleted.');
      } else {
        console.log('Tracker chat ID not found.');
      }
    } else {
      console.log('Twitter account not found.');
    }
  } catch (error) {
    console.error('Error in removeTrackerChatIdOrDelete:', error);
  }
}
export async function tiktokRemoveTrackerChatIdOrDelete(
  username: string,
  chatId: number,
) {
  try {
    // Find the document by twitterAccount
    const account = await this.TiktokAccountModel.findOne({
      tiktokAccount: username.slice(1),
    });

    if (account) {
      const { trackerChatIds } = account;

      // Check if trackerChatId exists in the array
      if (trackerChatIds.includes(chatId)) {
        if (trackerChatIds.length > 1) {
          // If there are multiple trackerChatIds, remove the specific chatId
          return await this.TiktokAccountModel.findOneAndUpdate(
            { tiktokAccount: username.slice(1) },
            { $pull: { trackerChatIds: chatId } },
          );
        } else {
          // If it's the only trackerChatId, delete the document
          return await this.TiktokAccountModel.findOneAndDelete({
            tiktokAccount: username.slice(1),
          });
        }
        console.log('Tracker chat ID removed or account deleted.');
      } else {
        console.log('Tracker chat ID not found.');
      }
    } else {
      console.log('Twitter account not found.');
    }
  } catch (error) {
    console.error('Error in removeTrackerChatIdOrDelete:', error);
  }
}
