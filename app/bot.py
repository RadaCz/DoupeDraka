import asyncio
import httpx
from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.types import Message
from .schemas import CharacterCreate
from .settings import get_settings

dp = Dispatcher()

@dp.message(Command("start"))
async def start(message: Message) -> None:
    await message.answer("Welcome, adventurer. Use /create <name> <race> <class>. Example: /create Arin human fighter. You'll need an API token from the web interface.")

@dp.message(Command("create"))
async def create_character(message: Message) -> None:
    parts = (message.text or "").split(maxsplit=3)
    if len(parts) != 4:
        await message.answer("Usage: /create <name> <race> <class>")
        return
    
    try:
        settings = get_settings()
        character_data = CharacterCreate(
            name=parts[1],
            race=parts[2],
            character_class=parts[3],
        )
        
        token = settings.bot_api_token
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{settings.api_url}/characters",
                json=character_data.model_dump(),
                headers={"Authorization": f"Bearer {token}"}
            )
            
        if response.status_code == 201:
            character_data_response = response.json()
            await message.answer(
                f"{character_data_response['name']}, "
                f"level 1 {character_data_response['race']} "
                f"{character_data_response['character_class']}, "
                "created successfully!"
            )
        else:
            error_msg = response.json().get("detail", "Unknown error")
            await message.answer(f"Failed to create character: {error_msg}")
            
    except httpx.HTTPStatusError as e:
        await message.answer(f"API error: {e.response.status_code}")
    except httpx.RequestError:
        await message.answer("Cannot connect to API server. Please check your connection.")
    except Exception as error:
        await message.answer(f"Error: {str(error)}")

async def main() -> None:
    token = get_settings().bot_token
    if not token:
        raise RuntimeError("BOT_TOKEN is required")
    await dp.start_polling(Bot(token))

if __name__ == "__main__":
    asyncio.run(main())
