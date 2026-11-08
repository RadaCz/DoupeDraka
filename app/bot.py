import asyncio

from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

from .settings import get_settings

dp = Dispatcher()


@dp.message(Command("start"))
async def start(message: Message) -> None:
    settings = get_settings()
    url = settings.mini_app_url.strip()
    if not url:
        await message.answer(
            "Vitej, dobrodruhu. Nastav MINI_APP_URL v prostredi bota a pridej tlacitko "
            "Mini App v BotFather, pak zde uvidis odkaz do hry."
        )
        return
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Otevrit DoupeDraka", web_app=WebAppInfo(url=url)),
    ]])
    await message.answer(
        "Vitej v DoupeDraka. Hra bezi v Telegram Mini App — tam vytvoris postavu, "
        "odesles akce a pokracujes v kampani.",
        reply_markup=keyboard,
    )


@dp.message(Command("create"))
async def create_character(message: Message) -> None:
    await message.answer(
        "Tvorbu postav spust v Mini App z /start. Bot uz neobchazi Telegram prihlaseni "
        "ani herni pravidla."
    )


@dp.message(Command("help"))
async def help_command(message: Message) -> None:
    await message.answer(
        "DoupeDraka bezi v Telegram Mini App.\n\n"
        "/start — otevrit hru\n"
        "/help — tento navod\n\n"
        "Postavu, tahy a kampan resis v aplikaci. Bot zatim neposila notifikace ani "
        "pozvanky do druziny (prijdou v dalsi fazi)."
    )


async def main() -> None:
    token = get_settings().bot_token
    if not token:
        raise RuntimeError("BOT_TOKEN is required")
    await dp.start_polling(Bot(token))


if __name__ == "__main__":
    asyncio.run(main())
