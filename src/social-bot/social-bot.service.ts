import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as TelegramBot from 'node-telegram-bot-api';
import { InstagramAccount } from './schemas/instagram.accounts.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { User } from './schemas/users.schema';
import {
  menuMarkup,
  viewInstagramAccount,
  welcomeMessageMarkup,
} from './markups';
import * as dotenv from 'dotenv';

import { Cron } from '@nestjs/schedule';
import { InstagramJob } from './schemas/job.schema';

dotenv.config();

const token = process.env.TEST_TOKEN;

@Injectable()
export class SocialBotService {
  private readonly socialBot: TelegramBot;
  private logger = new Logger(SocialBotService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(InstagramAccount.name)
    private readonly InstagramAccountModel: Model<InstagramAccount>,
    @InjectModel(User.name) private readonly UserModel: Model<User>,
    @InjectModel(InstagramJob.name)
    private readonly InstagramJobModel: Model<InstagramJob>,
  ) {
    this.socialBot = new TelegramBot(token, { polling: true });
    this.socialBot.on('message', this.handleRecievedMessages);
    this.socialBot.on('callback_query', this.handleButtonCommands);
    this.InstagramJobModel.deleteMany({});
    this.createInstagramJobData();
  }

  createInstagramJobData = async () => {
    await this.InstagramJobModel.deleteMany({});
    await this.InstagramJobModel.create({ isJobRunning: false });
  };

  handleRecievedMessages = async (
    msg: TelegramBot.Message,
  ): Promise<unknown> => {
    this.logger.debug(msg);
    try {
      await this.socialBot.sendChatAction(msg.chat.id, 'typing');
      function extractPlatformAndUsername(text) {
        // Adjusted regex pattern to match the username with more characters and optional whitespace
        const regex = /\/(twitter|tiktok|instagram)\s*@([\w.]+)/;
        const match = text.match(regex);

        if (match) {
          return {
            platform: match[1], // "twitter" or "tiktok" or "instagram"
            username: match[2], // The username after "@"
          };
        } else {
          return null; // Return null if no match is found
        }
      }

      const addMatch = extractPlatformAndUsername(msg.text.trim());
      const delRegex = /^\/del\s+(twitter|tiktok|instagram)\s+(@\w+)$/;
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
        if (addMatch.platform === 'instagram') {
          //TODO: VERIFY USERNAME BEFORE SAVING
          const validAccount: any = await this.validateInstagramAccount(
            addMatch.username,
            msg.chat.id,
          );
          if (validAccount.accountId) {
            const account = await this.InstagramAccountModel.findOne({
              instagramAccount: `${validAccount.instagramAccount}`,
            });
            if (account) {
              console.log(account);
              return await this.socialBot.sendMessage(
                msg.chat.id,
                `@${addMatch.username} instagram will be monitored.`,
              );
            }
            return;
          }
          return;
        } else if (addMatch.platform === 'tiktok') {
          return;
        }
        return;
      } else if (delMatch) {
        const platform = delMatch[1]; // This is either 'twitter' or 'tiktok' or username
        const username = delMatch[2]; // This is the @username
        if (platform == 'instagram') {
          const deletedAccount =
            await this.instagramRemoveTrackerChatIdOrDelete(
              username.slice(1),
              msg.chat.id,
            );

          if (deletedAccount) {
            return await this.socialBot.sendMessage(
              msg.chat.id,
              `${deletedAccount.instagramAccount} has been removed`,
            );
          }
          return await this.socialBot.sendMessage(
            msg.chat.id,
            'There was an error processing your message',
          );
        } else if (platform == 'tiktok') {
          return;
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

        case '/trackInsta':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');

            return await this.instagramUsernameInput(chatId);
          } catch (error) {
            console.log(error);
            return;
          }

        case '/viewInsta':
          try {
            await this.socialBot.sendChatAction(chatId, 'typing');
            console.log('hey');
            const instagramAccounts = await this.InstagramAccountModel.find({
              trackerChatId: { $in: [chatId] },
            });

            const allInstagramaccounts = [...instagramAccounts];
            const instagramMarkup =
              await viewInstagramAccount(allInstagramaccounts);
            const instagramReplyMarkup = {
              inline_keyboard: instagramMarkup.keyboard,
            };

            return await this.socialBot.sendMessage(
              chatId,
              instagramMarkup.message,
              {
                reply_markup: instagramReplyMarkup,
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

  instagramUsernameInput = async (chatId: number) => {
    try {
      await this.socialBot.sendMessage(chatId, '/instagram @username', {
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

  validateInstagramAccount = async (username: string, chatId: number) => {
    try {
      // Check if the account is already monitored
      const instagramAccount = await this.InstagramAccountModel.findOne({
        instagramAccount: username,
      });

      if (
        instagramAccount &&
        +instagramAccount.trackerChatId.includes(chatId)
      ) {
        return await this.socialBot.sendMessage(
          chatId,
          `You are already monitoring @${username} Instagram account.`,
        );
      } else if (instagramAccount) {
        await this.InstagramAccountModel.updateOne(
          {
            instagramAccount: instagramAccount.instagramAccount,
          },
          { trackerChatId: [...instagramAccount.trackerChatId, chatId] },
          //   { new: true, useFindAndModify: false },
        );
        return {
          trackerChatId: chatId,
          instagramAccount: instagramAccount.instagramAccount,
          accountId: instagramAccount.accountId,
        };
      }

      // Fetch the valid instagram account information
      const validAccount = await this.httpService.axiosRef.post(
        `https://instagram-scrapper-new.p.rapidapi.com/getUserInfoByUsername?username=${username}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      // If valid account data is returned
      if (validAccount.data.status === 'ok') {
        // Prepare to save new account data
        const saveInstagramUsername = new this.InstagramAccountModel({
          trackerChatId: [chatId],
          instagramAccount: username,
          accountId: validAccount.data.data.id,
          follwersCount: validAccount.data.data.follower_count,
        });

        // Use save method with error handling to prevent duplicates
        await saveInstagramUsername.save();

        // Only fetch paginated data if save is successful
        await this.fetchInstagramPaginatedData(validAccount.data.data.id);
        return {
          trackerChatId: [chatId],
          instagramAccount: username,
          accountId: validAccount.data.data.id,
          follwersCount: validAccount.data.data.follower_count,
        };
      }
    } catch (error) {
      console.error('Error validating Instagram account:', error);
      return await this.socialBot.sendMessage(
        chatId,
        `There was an error processing your action, please try again.`,
      );
    }
  };

  fetchInstagramPaginatedData = async (userId: string): Promise<void> => {
    try {
      // const params = cursor ? { cursor } : {};

      const response = await this.httpService.axiosRef.post(
        `https://instagram-scrapper-new.p.rapidapi.com/getFollowers?id=${userId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.users.map((user) => ({
        UsersuserId: user.id,
        username: user.username,
      }));

      // Use findOneAndUpdate with error handling
      await this.InstagramAccountModel.updateOne(
        { accountId: userId },
        {
          $set: {
            newAccountFollowers: formattedUsers,
            oldAccountFollowers: formattedUsers,
          },
        },
        // { new: true, useFindAndModify: false },
      );

      console.log('Fetched items:', response.data);

      // if (users.length > 0 && next_cursor > 0) {
      //   // delay in milliseconds before fetching data

      //   await this.fetchInstagramPaginatedData(userId, next_cursor);
      // } else {
      //   console.log('No more items to fetch.');
      // }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  fetchNewFollowInstagramPaginatedData = async (
    userId: string,
  ): Promise<void> => {
    try {
      // const params = cursor ? { cursor } : {};
      const response = await this.httpService.axiosRef.post(
        `https://instagram-scrapper-new.p.rapidapi.com/getFollowers?id=${userId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': process.env.RAPID_API_KEY,
            'x-rapidapi-host': process.env.RAPID_HOST,
          },
        },
      );

      const { data } = response.data;
      const formattedUsers = data.users.map((user) => ({
        UsersuserId: user.id,
        username: user.username,
      }));

      // Use findOneAndUpdate with error handling
      await this.InstagramAccountModel.updateOne(
        { accountId: userId },
        {
          $set: {
            newAccountFollowers: formattedUsers,
          },
        },
        //   { new: true, useFindAndModify: false },
      );
      const lastupdatedData = await this.InstagramAccountModel.findOne({
        accountId: userId,
      });
      if (lastupdatedData) {
        await this.notifyInstagram(
          lastupdatedData.oldAccountFollowers,
          lastupdatedData.newAccountFollowers,
          lastupdatedData.trackerChatId,
          lastupdatedData.instagramAccount,
          lastupdatedData.alertedFollowers,
        );
      }

      return;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  queryNewInstagramFollowers = async (): Promise<void> => {
    try {
      const allAccounts = await this.InstagramAccountModel.find();
      console.log(allAccounts);

      if (allAccounts.length > 0) {
        await Promise.all(
          allAccounts.map(async (account) => {
            // Fetch the valid Twitter account information
            // Fetch the valid instagram account information
            const validAccount = await this.httpService.axiosRef.post(
              `https://instagram-scrapper-new.p.rapidapi.com/getUserInfoByUsername?username=${account.instagramAccount}`,
              {},
              {
                headers: {
                  'Content-Type': 'application/json',
                  'x-rapidapi-key': process.env.RAPID_API_KEY,
                  'x-rapidapi-host': process.env.RAPID_HOST,
                },
              },
            );

            if (validAccount.data.status === 'ok') {
              await this.InstagramAccountModel.updateOne(
                { instagramAccount: account.instagramAccount },
                {
                  follwersCount: validAccount.data.data.follower_count,
                },
              );
              await this.fetchNewFollowInstagramPaginatedData(
                account.accountId,
              );
              return;
            }

            return;
          }),
        );
      }
      console.log('no account to monitor');
      return;

      // After updating, send notifications for new followers
    } catch (error) {
      console.error('Error querying new Instagram followers:', error);
    }
  };

  notifyInstagram = async (
    oldArray,
    newArray,
    chatIds,
    account,
    alertedFollowers,
  ) => {
    try {
      // Use filter to find new follows
      const addedFollows = newArray.filter((newItem) => {
        return !oldArray.some(
          (oldItem) => oldItem.username === newItem.username,
        );
      });

      // filter to check for already alerted followers
      const nonAlertedFollwers = addedFollows.filter(
        (obj1) =>
          !alertedFollowers.some((obj2) => obj2.username === obj1.username),
      );

      if (nonAlertedFollwers.length > 0) {
        await Promise.all(
          nonAlertedFollwers.map(async (newFollow) => {
            try {
              chatIds.forEach(async (chatId) => {
                await this.socialBot.sendMessage(
                  chatId,
                  `Follow alert  🚨:\n\n<a href="https://www.instagram.com/${newFollow.username}">@${newFollow.username}</a> followed @${account} twitter account`,
                  { parse_mode: 'HTML' },
                );
              });
            } catch (error) {
              console.log(error);
            }
          }),
        );
        await this.InstagramAccountModel.updateOne(
          { instagramAccount: account },
          {
            $set: { oldAccountFollowers: newArray }, // Set the new followers array
            $push: { alertedFollowers: { $each: nonAlertedFollwers } }, // Push each non-alerted follower
          },
        );
        return;
      } else {
        console.log('No new elements added.');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  };

  // notifyInstagramByNumber = async (
  //   oldFollowCount,
  //   newFollowCount,
  //   chatIds,
  //   account,
  // ) => {
  //   try {
  //     if (newFollowCount - oldFollowCount > 0) {
  //       chatIds.forEach(async (chatId) => {
  //         return await this.socialBot.sendMessage(
  //           chatId,
  //           `Follow alert  🚨:\n\n${newFollowCount - oldFollowCount} new accounts followed @${account} twitter account`,
  //         );
  //       });
  //     }
  //     return;
  //   } catch (error) {
  //     console.error('Error sending notifications:', error);
  //   }
  // };

  //cronJob

  // @Cron('*/30 * * * *')
  @Cron(`${process.env.CRON}`)
  async handleTwitterCron() {
    const jobRunning = await this.InstagramJobModel.find();
    if (jobRunning[0].isJobRunning) {
      // If a job is already running, exit early to prevent data pollution

      return;
    }

    // Set the flag to indicate the job is running
    await this.InstagramJobModel.updateOne(
      { _id: jobRunning[0]._id },
      { isJobRunning: true },
    );

    try {
      // Call your function to query new Twitter followers
      await this.queryNewInstagramFollowers();
    } catch (error) {
      // Handle any errors that may occur during execution
      console.error('Error in cron job:', error);
    } finally {
      // Reset the flag to indicate the job has completed
      await this.InstagramJobModel.updateOne(
        { _id: jobRunning[0]._id },
        { isJobRunning: false },
      );
    }
  }

  // utility functions:
  async instagramRemoveTrackerChatIdOrDelete(username: string, chatId: number) {
    try {
      // Find the document by twitterAccount
      const account = await this.InstagramAccountModel.findOne({
        instagramAccount: username,
      });

      if (account) {
        const { trackerChatId } = account;

        // Check if trackerChatId exists in the array
        if (trackerChatId.includes(chatId)) {
          if (trackerChatId.length > 1) {
            // If there are multiple trackerChatIds, remove the specific chatId
            return await this.InstagramAccountModel.findOneAndUpdate(
              { instagramAccount: username },
              { $pull: { trackerChatId: chatId } },
            );
          } else {
            // If it's the only trackerChatId, delete the document
            return await this.InstagramAccountModel.findOneAndDelete({
              instagramAccount: username,
            });
          }
        } else {
          console.log('Tracker chat ID not found.');
        }
      } else {
        console.log('instagram account not found.');
      }
    } catch (error) {
      console.error('Error in instagramRemoveTrackerChatIdOrDelete:', error);
    }
  }
}
