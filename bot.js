const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')

// Configuration
const BOT_TOKEN = '7941763154:AAE5P1JPrUrdnf1F_Fbn9snsF9jcE94-Z90'
const ADMIN_ID = 6994528708
const CHANNEL_ID = -1002420029455
const CHANNEL_LINK = 'https://t.me/+IGuHMrz7ASszZDg1'
const REDEMPTION_USERNAME = '@Its_solox'

const bot = new Telegraf(BOT_TOKEN)

// Data storage initialization
let referrals = {}
try {
  referrals = JSON.parse(fs.readFileSync('referrals.json'))
} catch (err) {
  console.log('Initializing new referrals database')
}

// Utility functions
function saveData() {
  fs.writeFileSync('referrals.json', JSON.stringify(referrals))
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function initUser(userId) {
  if (!referrals[userId]) {
    referrals[userId] = {
      points: 0,
      balance: 0,
      code: generateCode(),
      referrals: []
    }
    saveData()
  }
}

// Main menu keyboard matching the image UI
function getMainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Balance', 'balance'),
      Markup.button.callback('⭐ Invite', 'invite')
    ],
    [
      Markup.button.callback('👛 Wallet', 'wallet'),
      Markup.button.callback('🔥 Withdraw', 'withdraw')
    ],
    [
      Markup.button.callback('📊 Statistics', 'statistics')
    ]
  ])
}

// Middleware: Channel membership check
bot.use(async (ctx, next) => {
  if (ctx.updateType === 'message' || ctx.updateType === 'callback_query') {
    try {
      const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id)
      if (member.status === 'left') {
        await ctx.reply(
          `📢 Please join our channel to continue:\n${CHANNEL_LINK} after join click /start`,
          Markup.inlineKeyboard([Markup.button.url('Join Channel', CHANNEL_LINK)])
        )
        return
      }
    } catch (error) {
      console.error('Channel check error:', error)
      await ctx.reply('⚠️ Service temporarily unavailable. Please try again later.')
      return
    }
  }
  await next()
})

// Start command handler
bot.start(async (ctx) => {
  const userId = ctx.from.id
  initUser(userId)
  
  const startPayload = ctx.message.text.split(' ')[1]
  if (startPayload && startPayload !== userId.toString()) {
    const referrerId = startPayload
    if (referrals[referrerId] && !referrals[referrerId].referrals.includes(userId)) {
      referrals[referrerId].referrals.push(userId)
      referrals[referrerId].points = Math.min(referrals[referrerId].points + 1, 5)
      saveData()
      
      ctx.telegram.sendMessage(
        referrerId,
        `🎉 New referral! ${ctx.from.first_name} joined!\n` +
        `You need ${5 - referrals[referrerId].points} more referrals to claim your reward!`
      )
    }
  }

  await ctx.reply(
    `👋 Welcome to the Prime Video Rewards Bot, ${ctx.from.first_name}!\nUse the menu below to navigate:`,
    getMainKeyboard()
  )
})

// Menu command
bot.command('menu', async (ctx) => {
  await ctx.reply('📱 Main Menu:', getMainKeyboard())
})

// Action handlers
bot.action('balance', async (ctx) => {
  const userData = referrals[ctx.from.id]
  await ctx.answerCbQuery()
  await ctx.reply(
    `💰 Your Current Balance:\n\n` +
    `⭐ Referral Points: ${userData.points}/5\n` +
    `🏆 Prime Video accounts earned: ${Math.floor(userData.balance/5)}`,
    getMainKeyboard()
  )
})

bot.action('invite', async (ctx) => {
  const referralLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`
  await ctx.answerCbQuery()
  await ctx.reply(
    `⭐ Your Referral Link:\n\n` +
    `<code>${referralLink}</code>\n\n` +
    `Share this link with friends. You need 5 successful referrals to claim your Prime Video account!`,
    { 
      parse_mode: 'HTML',
      ...getMainKeyboard()
    }
  )
})

bot.action('wallet', async (ctx) => {
  const userData = referrals[ctx.from.id]
  await ctx.answerCbQuery()
  await ctx.reply(
    `👛 Your Wallet:\n\n` +
    `💰 Current Points: ${userData.points}/5\n` +
    `👥 Total Referrals: ${userData.referrals.length}\n` +
    `🎁 Accounts Redeemed: ${Math.floor(userData.balance/5)}`,
    getMainKeyboard()
  )
})

bot.action('withdraw', async (ctx) => {
  const userData = referrals[ctx.from.id]
  await ctx.answerCbQuery()
  
  if (userData.points >= 5) {
    const redemptionCode = generateCode()
    userData.code = redemptionCode
    userData.points = 0
    userData.balance += 5
    saveData()
    
    await ctx.reply(
      `🔥 Withdrawal Successful!\n\n` +
      `Your unique code: <b>${redemptionCode}</b>\n\n` +
      `DM ${REDEMPTION_USERNAME} with this code to claim your Prime Video account.`,
      { 
        parse_mode: 'HTML',
        ...getMainKeyboard()
      }
    )
  } else {
    await ctx.reply(
      `❌ Insufficient Points!\n\n` +
      `You need ${5 - userData.points} more referrals to withdraw.`,
      getMainKeyboard()
    )
  }
})

bot.action('statistics', async (ctx) => {
  const userData = referrals[ctx.from.id]
  await ctx.answerCbQuery()
  
  const totalUsers = Object.keys(referrals).length
  const totalReferrals = userData.referrals.length
  
  await ctx.reply(
    `📊 Your Statistics:\n\n` +
    `👥 Your Referrals: ${totalReferrals}\n` +
    `⭐ Available Points: ${userData.points}/5\n` +
    `🎁 Accounts Earned: ${Math.floor(userData.balance/5)}\n\n` +
    `📈 Bot Statistics:\n` +
    `👤 Total Users: ${totalUsers}`,
    getMainKeyboard()
  )
})

// Admin commands
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id === ADMIN_ID) {
    const message = ctx.message.text.split(' ').slice(1).join(' ')
    const users = Object.keys(referrals)
    let successCount = 0
    
    for (const userId of users) {
      try {
        await ctx.telegram.sendMessage(userId, message)
        successCount++
      } catch (error) {
        console.error(`Failed to send to ${userId}:`, error.message)
      }
    }
    
    ctx.reply(`📣 Broadcast sent to ${successCount}/${users.length} users.`)
  }
})

bot.command('lookupcodes', (ctx) => {
  if (ctx.from.id === ADMIN_ID) {
    const codes = Object.entries(referrals).map(([userId, data]) => {
      return `User ID: ${userId} - Code: ${data.code} - Referrals: ${data.referrals.length}`
    }).join('\n')
    
    ctx.reply(`🔍 All Redemption Codes:\n\n${codes || 'No codes available.'}`)
  }
})

bot.command('lookupcode', (ctx) => {
  if (ctx.from.id === ADMIN_ID) {
    const code = ctx.message.text.split(' ')[1]
    const userEntry = Object.entries(referrals).find(([_, data]) => data.code === code)
    
    if (userEntry) {
      ctx.reply(
        `🔍 Code ${code} belongs to:\n` +
        `User ID: ${userEntry[0]}\n` +
        `Referrals: ${userEntry[1].referrals.length}\n` +
        `Points: ${userEntry[1].points}\n` +
        `Balance: ${userEntry[1].balance}`
      )
    } else {
      ctx.reply('❌ Invalid redemption code.')
    }
  }
})

// Start the bot
bot.launch()
  .then(() => console.log('Bot started successfully'))
  .catch(err => console.error('Bot failed to start:', err))

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
