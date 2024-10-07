import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { TwitterAccount } from './schemas/twitter.accounts.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import { TiktokAccount } from './schemas/tiktok.accounts.schema';
import {
  menuMarkup,
  viewTiktokAccount,
  viewTwitterAccount,
  welcomeMessageMarkup,
} from './markups';
import * as dotenv from 'dotenv';
import { TaskQueue } from './schemas/taskQueue.schema';
import { Cron } from '@nestjs/schedule';
import { TiktokJob, TwitterJob } from './schemas/job.schema';

dotenv.config();

const token = process.env.TEST_TOKEN;

@Injectable()
export class SocialBotService {
  private readonly socialBot: TelegramBot;
  private logger = new Logger(SocialBotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(TwitterAccount.name)
    private readonly TwitterAccountModel: Model<TwitterAccount>,
    @InjectModel(TiktokAccount.name)
    private readonly TiktokAccountModel: Model<TiktokAccount>,
    @InjectModel(TaskQueue.name)
    private readonly TaskQueueModel: Model<TaskQueue>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(TwitterJob.name)
    private readonly TwitterJobModel: Model<TwitterJob>,
    @InjectModel(TiktokJob.name)
    private readonly TiktokJobModel: Model<TiktokJob>,
  ) {
    this.socialBot = new TelegramBot(token, { polling: true });
    this.socialBot.on('message', this.handleRecievedMessages);
    this.socialBot.on('callback_query', this.handleButtonCommands);
    this.TwitterJobModel.deleteMany({});
    this.createTwitterJobData();
    this.TiktokJobModel.deleteMany({});
    this.createTiktokJobData();
  }

  createTwitterJobData = async () => {
    await this.TwitterJobModel.deleteMany({});
    await this.TwitterJobModel.create({ isJobRunning: false });
  };

  createTiktokJobData = async () => {
    await this.TiktokJobModel.deleteMany({});
    await this.TiktokJobModel.create({ isJobRunning: false });
  };

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.socialBot.sendChatAction(msg.chat.id, 'typing');
      function extractPlatformAndUsername(text) {
        const regex = /\/(twitter|tiktok) @(\w+)/;
        const match = text.match(regex);

        if (match) {
          return {
            platform: match[1], // "twitter" or "tiktok"
            username: match[2], // The username after "@"
          };
        } else {
          return null; // Return null if no match is found
        }
      }

      const addMatch = extractPlatformAndUsername(msg.text.trim());
      const delRegex = /^\/del\s+(twitter|tiktok)\s+(@\w+)$/;
      const delMatch = msg.text.trim().match(delRegex);

      if (msg.text.trim() === '/start') {
        const userExist = await this.UserModel.findOne({
          userChatId: msg.chat.id,
        });
        if (!userExist) {
          const savedUser = new this.UserModel({
            userChatId: msg.chat.id,
            username: msg.from.username,
          });
          savedUser.save();
        }
        const username: string = `${msg.from.username}`;
        const welcome = await welcomeMessageMarkup(username);
        const replyMarkup = {
          inline_keyboard: welcome.keyboard,
        };
        return await this.socialBot.sendMessage(msg.chat.id, welcome.message, {
          reply_markup: replyMarkup,
        });
      } else if (addMatch) {
        if (addMatch.platform === 'twitter') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTwitterAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (validAccount.accountId) {
            const account = await this.TwitterAccountModel.findOne({
              twitterAccount: `${validAccount.twitterAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `@${addMatch.username}twitter will be monitored.`,
              );
            }
            return;
          }
          return;
        } else if (addMatch.platform === 'tiktok') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateTiktokAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (validAccount.accountId) {
            const account = await this.TiktokAccountModel.findOne({
              tiktokAccount: `${validAccount.tiktokAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `@${addMatch.username} tiktok will be monitored.`,
              );
            }
            return;
          }
          return;
        }
        return;
      } else if (delMatch) {
        const platform = delMatch[1]; // This is either 'twitter' or 'tiktok'
        const username = delMatch[2]; // This is the @username
        if (platform == 'twitter') {
          const deletedAccount = await this.twitterRemoveTrackerChatIdOrDelete(
            username.slice(1),
            msg.chat.id,
          );

          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `${deletedAccount.twitterAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
        } else if (platform == 'tiktok') {
          const deletedAccount = await this.tiktokRemoveTrackerChatIdOrDelete(
            username.slice(1),
            msg.chat.id,
          );
          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `${deletedAccount.tiktokAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
        }
      } else if (msg.text.trim() === '/menu') {
        const userExist = await this.UserModel.findOne({
          userChatId: msg.chat.id,
        });
        if (!userExist) {
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'Start the app first, /start or click the start button',
          );
        }
        return await this.defaultMenu(msg.chat.id);
      }
    } catch (error) {
      console.log(error);
      return await this.socialBot.sendMessage(
        msg.chat.id,
        'There was an error processing your message',
      );
    }
  };

  handleButtonCommands = async (
    query: TelegramBot.CallbackQuery,
  ): Promise<unknown> => {
    this.logger.debug(query);
    let command: string;

    // const username = `${query.from.username}`;
    const chatId = query.message.chat.id;

    // function to check if query.data is a json type
    function isJSON(str: string) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    try {
      console.log(command);

      switch (command) {
        case '/menu':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            return await this.defaultMenu(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/trackX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');

            return await this.twitterUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/trackTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            return await this.tiktokUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewX':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const twitterAccounts = await this.TwitterAccountModel.find({
              trackerChatId: { $in: [chatId] },
            });

            const allTwitteraccounts = [...twitterAccounts];
            const twitterMarkup = await viewTwitterAccount(allTwitteraccounts);
            const twitterReplyMarkup = {
              inline_keyboard: twitterMarkup.keyboard,
            };

            return await this.socialBot.sendMessage(
              chatId,
              twitterMarkup.message,
              {
                reply_markup: twitterReplyMarkup,
              },
            );
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewTiktok':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const tiktokAccounts = await this.TiktokAccountModel.find({
              trackerChatId: { $in: [chatId] },
            });

            const alltiktokAccounts = [...tiktokAccounts];
            const tiktokMarkup = await viewTiktokAccount(alltiktokAccounts);
            const tiktokMarkupReply = {
              inline_keyboard: tiktokMarkup.keyboard,
            };

            return await this.socialBot.sendMessage(
              chatId,
              tiktokMarkup.message,
              {
                reply_markup: tiktokMarkupReply,
              },
            );
          } catch (error) {
            console.log(error);
            return;
          }

        case '/close':
          await this.socialBot.sendChatAction(query.message.chat.id, 'typing');
          return await this.socialBot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        default:
          return await this.socialBot.sendMessage(
            chatId,
            'There was an error processing your message',
          );
      }
    } catch (error) {
      console.log(error);
      return await this.socialBot.sendMessage(
        chatId,
        'There was an error processing your message',
      );
    }
  };

  twitterUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(chatId, '/twitter @username', {
        reply_markup: {
          force_reply: true,
        },
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  defaultMenu = async (chatId: number) => {
    try {
      const menu = await menuMarkup();
      const replyMarkup = {
        inline_keyboard: menu.keyboard,
      };
      return await this.socialBot.sendMessage(chatId, menu.message, {
        reply_markup: replyMarkup,
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  tiktokUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(chatId, '/tiktok @username', {
        reply_markup: {
          force_reply: true,
        },
      });

      return;
    } catch (error) {
      console.log(error);
    }
  };

  validateTwitterAccount = async (username: string, chatId: number) => {
    try {
      // Check if the account is already monitored
      const twitterAccount = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
      });

      if (twitterAccount && +twitterAccount.trackerChatId.includes(chatId)) {
        return await this.socialBot.sendMessage(
          chatId,
          `You are already monitoring @${username} Twitter account.`,
        );
      } else if (twitterAccount) {
        await this.TwitterAccountModel.updateOne(
          {
            twitterAccount: twitterAccount.twitterAccount,
          },
          { trackerChatId: [...twitterAccount.trackerChatId, chatId] },
          //   { new: true, useFindAndModify: false },
        );
        return {
          trackerChatId: chatId,
          twitterAccount: twitterAccount.twitterAccount,
          accountId: twitterAccount.accountId,
        };
      }

      // Fetch the valid Twitter account information
      const validAccount = await this.httpService.axiosRef.get(
        `https://twitter-api47.p.rapidapi.com/v2/user/by-username?username=${username}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data) {
        // Prepare to save new account data
        const saveTwitterUsername = new this.TwitterAccountModel({
          trackerChatId: [chatId],
          twitterAccount: username,
          accountId: validAccount.data.rest_id,
          follwersCount: validAccount.data.legacy.followers_count,
        });

        // Use save method with error handling to prevent duplicates
        await saveTwitterUsername.save();

        if (validAccount.data.legacy.followers_count <= 1000) {
          // Only fetch paginated data if save is successful
          await this.fetchTwitterPaginatedData(validAccount.data.rest_id);
          return {
            trackerChatId: [chatId],
            twitterAccount: username,
            accountId: validAccount.data.rest_id,
            follwersCount: validAccount.data.legacy.followers_count,
          };
        }
        return {
          trackerChatId: [chatId],
          twitterAccount: username,
          accountId: validAccount.data.rest_id,
          follwersCount: validAccount.data.legacy.followers_count,
        };
      }
    } catch (error) {
      console.error('Error validating Twitter account:', error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  fetchTwitterPaginatedData = async (
    userId: string,
    cursor?: string,
  ): Promise<void> => {
    try {
      const params = cursor ? { cursor } : {};

      const response = await this.httpService.axiosRef.get(
        `https://twitter-api47.p.rapidapi.com/v2/user/followers-list?userId=${userId}&count=200`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
          params,
        },
      );

      const { users, cursor: next_cursor } = response.data;
      const formattedUsers = users.map((user) => ({
        UsersuserId: user.id_str,
        username: user.screen_name,
      }));

      // Use findOneAndUpdate with error handling
      await this.TwitterAccountModel.updateOne(
        { accountId: userId },
        {
          $push: {
            newAccountFollowers: { $each: formattedUsers },
            oldAccountFollowers: { $each: formattedUsers },
          },
        },
        // { new: true, useFindAndModify: false },
      );

      console.log('Fetched items:', response.data);

      if (users.length > 0 && next_cursor > 0) {
        // delay in milliseconds before fetching data

        await this.fetchTwitterPaginatedData(userId, next_cursor);
      } else {
        console.log('No more items to fetch.');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  fetchNewFollowTwitterPaginatedData = async (
    userId: string,
    id: any,
    cursor?: string,
    firstCall: boolean = true,
  ): Promise<void> => {
    try {
      const params = cursor ? { cursor } : {};

      const response = await this.httpService.axiosRef.get(
        `https://twitter-api47.p.rapidapi.com/v2/user/followers-list?userId=${userId}&count=200`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
          params,
        },
      );

      const { users, cursor: nextCursor } = response.data;
      const formattedUsers = users.map((user) => ({
        UsersuserId: user.rest_id,
        username: user.screen_name,
      }));

      // Clear newAccountFollowers on the first call
      if (firstCall) {
        const olddata = await this.TwitterAccountModel.findOne({
          accountId: userId,
        });
        // set the olddata to be the newOne

        await this.TwitterAccountModel.updateOne(
          { _id: olddata._id },
          {
            oldAccountFollowers: olddata.newAccountFollowers,
          },
          //   { new: true, useFindAndModify: false },
        );

        await this.TwitterAccountModel.updateOne(
          { accountId: userId },
          {
            newAccountFollowers: formattedUsers,
          },
          //   { new: true, useFindAndModify: false },
        );
      } else {
        await this.TwitterAccountModel.updateOne(
          { accountId: userId },
          {
            $push: {
              newAccountFollowers: { $each: formattedUsers },
            },
          },
          //   { new: true, useFindAndModify: false },
        );
      }

      console.log('Fetched items:', formattedUsers);

      if (users.length > 0 && nextCursor) {
        // delay in milliseconds before fetching data

        await this.fetchNewFollowTwitterPaginatedData(
          userId,
          id,
          nextCursor,
          false,
        );
      } else {
        console.log('No more items to fetch.');

        const lastupdatedData = await this.TwitterAccountModel.findOne({
          accountId: userId,
        });
        if (lastupdatedData) {
          await this.notifyTwitter(
            lastupdatedData.oldAccountFollowers,
            lastupdatedData.newAccountFollowers,
            lastupdatedData.trackerChatId,
            lastupdatedData.twitterAccount,
          );
        }

        return;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  queryNewTwitterFollowers = async (): Promise<void> => {
    try {
      const allAccounts = await this.TwitterAccountModel.find();
      console.log(allAccounts);

      // Fetch new followers in parallel for all accounts
      await Promise.all(
        allAccounts.map(async (account) => {
          // Fetch the valid Twitter account information
          const validAccount = await this.httpService.axiosRef.get(
            `https://twitter-api47.p.rapidapi.com/v2/user/by-username?username=${account.twitterAccount}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-rapidapi-key': process.env.RAPID_API_KEY,
                'x-rapidapi-host': process.env.RAPID_HOST,
              },
            },
          );
          if (validAccount.data.legacy.followers_count <= 1000) {
            await this.fetchNewFollowTwitterPaginatedData(
              account.accountId,
              account._id,
            );
            await this.TwitterAccountModel.updateOne(
              { twitterAccount: account.twitterAccount },
              { follwersCount: validAccount.data.legacy.followers_count },
            );
          }
          await this.TwitterAccountModel.updateOne(
            { twitterAccount: account.twitterAccount },
            { follwersCount: validAccount.data.legacy.followers_count },
          );
          await this.notifyTwitterByNumber(
            account.follwersCount,
            validAccount.data.legacy.followers_count,
            account.trackerChatId,
            account.twitterAccount,
          );

          return;
        }),
      );

      // After updating, send notifications for new followers
    } catch (error) {
      console.error('Error querying new Twitter followers:', error);
    }
  };

  notifyTwitter = async (oldArray, newArray, chatIds, account) => {
    try {
      // Use filter to find new follows
      const addedFollows = newArray.filter((newItem) => {
        return !oldArray.some(
          (oldItem) => oldItem.username === newItem.username,
        );
      });

      if (addedFollows.length > 0) {
        await Promise.all(
          addedFollows.map(async (newFollow) => {
            try {
              chatIds.forEach(async (chatId) => {
                await this.socialBot.sendMessage(
                  chatId,
                  `Follow alert  🚨:\n\n@${newFollow.username} followed @${account} twitter account`,
                );
              });
            } catch (error) {
              console.log(error);
            }
          }),
        );
        return;
      } else {
        console.log('No new elements added.');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };
  notifyTwitterByNumber = async (
    oldFollowCount,
    newFollowCount,
    chatIds,
    account,
  ) => {
    try {
      if (newFollowCount - oldFollowCount > 0) {
        chatIds.forEach(async (chatId) => {
          return await this.socialBot.sendMessage(
            chatId,
            `Follow alert  🚨:\n\n${newFollowCount - oldFollowCount} new accounts followed @${account} twitter account`,
          );
        });
      }
      return;
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  validateTiktokAccount = async (username: string, chatId: number) => {
    try {
      // Check if the account is already monitored
      const tiktokAccount = await this.TiktokAccountModel.findOne({
        tiktokAccount: username,
      });

      if (tiktokAccount && +tiktokAccount.trackerChatId.includes(chatId)) {
        return await this.socialBot.sendMessage(
          chatId,
          `You are already monitoring @${username} Tiktok account.`,
        );
      } else if (tiktokAccount) {
        await this.TiktokAccountModel.updateOne(
          {
            tiktokAccount: tiktokAccount.tiktokAccount,
          },
          { trackerChatId: [...tiktokAccount.trackerChatId, chatId] },
          //   { new: true, useFindAndModify: false },
        );
        return {
          trackerChatId: chatId,
          tiktokAccount: tiktokAccount.tiktokAccount,
          accountId: tiktokAccount.accountId,
        };
      }

      // Fetch the valid Tiktok account information
      const validAccount = await this.httpService.axiosRef.get(
        `https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=${username}`,

        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY2,
            'x-rapidapi-host': process.env.RAPID_HOST_TIKTOK,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data.data.user) {
        // Prepare to save new account data
        const saveTiktokUsername = new this.TiktokAccountModel({
          trackerChatId: [chatId],
          tiktokAccount: username,
          accountId: validAccount.data.data.user.id,
        });

        // Use save method with error handling to prevent duplicates
        await saveTiktokUsername.save();

        // Only fetch paginated data if save is successful
        await this.fetchTiktokPaginatedData(validAccount.data.data.user.id);
        return {
          trackerChatId: [chatId],
          tiktokAccount: username,
          accountId: validAccount.data.data.user.id,
        };
        return;
      }
    } catch (error) {
      console.error('Error validating Tiktok account:', error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  fetchTiktokPaginatedData = async (
    userId: string,
    time?: number,
  ): Promise<void> => {
    try {
      const params = time ? { time, count: 200 } : { count: 200 };

      const response = await this.httpService.axiosRef.get(
        `https://tiktok-scraper7.p.rapidapi.com/user/followers?user_id=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY2,
            'x-rapidapi-host': process.env.RAPID_HOST_TIKTOK,
          },
          params,
        },
      );

      const { data } = response.data;
      const formattedUsers = data.followers.map((user) => ({
        UsersuserId: user.id,
        username: user.unique_id,
      }));

      // Use findOneAndUpdate with error handling
      await this.TiktokAccountModel.updateOne(
        { accountId: userId },
        {
          $push: {
            newAccountFollowers: { $each: formattedUsers },
            oldAccountFollowers: { $each: formattedUsers },
          },
        },
        // { new: true, useFindAndModify: false },
      );

      console.log('Fetched items:', formattedUsers);

      if (data.followers > 0 && data.hasMore) {
        await this.fetchTwitterPaginatedData(userId, data.time);
      } else {
        console.log('No more items to fetch.');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  fetchNewFollowTiktokPaginatedData = async (
    userId: string,
    time?: string,
    firstCall: boolean = true,
  ): Promise<void> => {
    try {
      const params = time ? { time, count: 200 } : { count: 200 };

      const response = await this.httpService.axiosRef.get(
        `https://tiktok-scraper7.p.rapidapi.com/user/followers?user_id=${userId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY2,
            'x-rapidapi-host': process.env.RAPID_HOST_TIKTOK,
          },
          params,
        },
      );

      const { data } = response.data;
      const formattedUsers = data.followers.map((user) => ({
        UsersuserId: user.id,
        username: user.unique_id,
      }));

      // Clear newAccountFollowers on the first call
      if (firstCall) {
        const olddata = await this.TiktokAccountModel.findOne({
          accountId: userId,
        });
        // set the olddata to be the newOne
        await this.TiktokAccountModel.updateOne(
          { _id: olddata._id },
          {
            oldAccountFollowers: olddata.newAccountFollowers,
          },
          //   { new: true, useFindAndModify: false },
        );
        await this.TiktokAccountModel.updateOne(
          { accountId: userId },
          {
            newAccountFollowers: formattedUsers,
          },
          //   { new: true, useFindAndModify: false },
        );
      } else {
        await this.TiktokAccountModel.updateOne(
          { accountId: userId },
          {
            $push: {
              newAccountFollowers: { $each: formattedUsers },
            },
          },
          //   { new: true, useFindAndModify: false },
        );
      }

      console.log('Fetched items:', formattedUsers);

      if (data.followers > 0 && data.hasMore) {
        await this.fetchNewFollowTiktokPaginatedData(userId, data.time, false);
      } else {
        console.log('No more items to fetch.');
        const lastupdatedData = await this.TiktokAccountModel.findOne({
          accountId: userId,
        });
        if (lastupdatedData) {
          await this.notifyTiktok(
            lastupdatedData.oldAccountFollowers,
            lastupdatedData.newAccountFollowers,
            lastupdatedData.trackerChatId,
            lastupdatedData.tiktokAccount,
          );
        }

        return;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  notifyTiktok = async (oldArray, newArray, chatIds, account) => {
    try {
      // Use filter to find new follows
      const addedFollows = newArray.filter((newItem) => {
        return !oldArray.some(
          (oldItem) => oldItem.username === newItem.username,
        );
      });

      if (addedFollows.length > 0) {
        await Promise.all(
          addedFollows.map(async (newFollow) => {
            try {
              chatIds.forEach(async (chatId) => {
                await this.socialBot.sendMessage(
                  chatId,
                  `Follow alert  🚨:\n\n@${newFollow.username} followed @${account} tiktok Account`,
                );
              });
            } catch (error) {
              console.log(error);
            }
          }),
        );
        return;
      } else {
        console.log('No new elements added.');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  queryNewTiktokFollowers = async (): Promise<void> => {
    try {
      const allAccounts = await this.TiktokAccountModel.find();
      console.log(allAccounts);

      // Fetch new followers in parallel for all accounts
      await Promise.all(
        allAccounts.map(async (account) => {
          await this.fetchNewFollowTiktokPaginatedData(account.accountId);
        }),
      );

      // After updating, send notifications for new followers
    } catch (error) {
      console.error('Error querying new Tiktok followers:', error);
    }
  };

  //cronJob

  // @Cron('*/30 * * * *')
  @Cron('*/3 * * * *')
  async handleTwitterCron() {
    const jobRunning = await this.TwitterJobModel.find();
    if (jobRunning[0].isJobRunning) {
      // If a job is already running, exit early to prevent data pollution
      console.log('Job is running');
      return;
    }

    // Set the flag to indicate the job is running
    await this.TwitterJobModel.updateOne(
      { _id: jobRunning[0]._id },
      { isJobRunning: true },
    );

    try {
      // Call your function to query new Twitter followers
      await this.queryNewTwitterFollowers();
    } catch (error) {
      // Handle any errors that may occur during execution
      console.error('Error in cron job:', error);
    } finally {
      // Reset the flag to indicate the job has completed
      await this.TwitterJobModel.updateOne(
        { _id: jobRunning[0]._id },
        { isJobRunning: false },
      );
    }
  }

  // @Cron('*/1 * * * *')
  @Cron('0 */3 * * *')
  async handleTiktokCron() {
    const jobRunning = await this.TiktokJobModel.find();
    if (jobRunning[0].isJobRunning) {
      // If a job is already running, exit early to prevent data pollution
      console.log('Job is running');
      return;
    }

    // Set the flag to indicate the job is running
    await this.TiktokJobModel.updateOne(
      { _id: jobRunning[0]._id },
      { isJobRunningTiktok: true },
    );

    try {
      // Call your function to query new Twitter followers
      await this.queryNewTiktokFollowers();
    } catch (error) {
      // Handle any errors that may occur during execution
      console.error('Error in cron job:', error);
    } finally {
      // Reset the flag to indicate the job has completed
      await this.TiktokJobModel.updateOne(
        { _id: jobRunning[0]._id },
        { isJobRunning: false },
      );
    }
  }

  // utility functions:
  async twitterRemoveTrackerChatIdOrDelete(username: string, chatId: number) {
    try {
      // Find the document by twitterAccount
      const account = await this.TwitterAccountModel.findOne({
        twitterAccount: username,
      });

      if (account) {
        const { trackerChatId } = account;

        // Check if trackerChatId exists in the array
        if (trackerChatId.includes(chatId)) {
          if (trackerChatId.length > 1) {
            // If there are multiple trackerChatIds, remove the specific chatId
            return await this.TwitterAccountModel.findOneAndUpdate(
              { twitterAccount: username },
              { $pull: { trackerChatId: chatId } },
            );
          } else {
            // If it's the only trackerChatId, delete the document
            return await this.TwitterAccountModel.findOneAndDelete({
              twitterAccount: username,
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
      console.error('Error in TwitterremoveTrackerChatIdOrDelete:', error);
    }
  }
  async tiktokRemoveTrackerChatIdOrDelete(username: string, chatId: number) {
    try {
      // Find the document by twitterAccount
      const account = await this.TiktokAccountModel.findOne({
        tiktokAccount: username,
      });

      if (account) {
        console.log(account);
        const { trackerChatId } = account;

        // Check if trackerChatId exists in the array
        if (trackerChatId.includes(chatId)) {
          if (trackerChatId.length > 1) {
            // If there are multiple trackerChatIds, remove the specific chatId
            return await this.TiktokAccountModel.findOneAndUpdate(
              { tiktokAccount: username },
              { $pull: { trackerChatId: chatId } },
            );
          } else {
            // If it's the only trackerChatId, delete the document
            return await this.TiktokAccountModel.findOneAndDelete({
              tiktokAccount: username,
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
      console.error('Error in tiktokRemoveTrackerChatIdOrDelete:', error);
    }
  }
}
