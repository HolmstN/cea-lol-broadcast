---
name: lcu
description: LCU (League Client Update) integration for CEA LoL Broadcast. Use when you need to interact with the League client — listen for events, fetch data, or trigger actions. Pass the feature name or topic as the prompt.
---

## LCU AllGameData example response

```json
{
	"activePlayer": {
		"abilities": {
			"E": {
				"abilityLevel": 0,
				"displayName": "Shifting Sands",
				"id": "AzirEWrapper",
				"rawDescription": "GeneratedTip_Spell_AzirEWrapper_Description",
				"rawDisplayName": "GeneratedTip_Spell_AzirEWrapper_DisplayName"
			},
			"Passive": {
				"displayName": "Shurima's Legacy",
				"id": "AzirPassive",
				"rawDescription": "GeneratedTip_Passive_AzirPassive_Description",
				"rawDisplayName": "GeneratedTip_Passive_AzirPassive_DisplayName"
			},
			"Q": {
				"abilityLevel": 0,
				"displayName": "Conquering Sands",
				"id": "AzirQWrapper",
				"rawDescription": "GeneratedTip_Spell_AzirQWrapper_Description",
				"rawDisplayName": "GeneratedTip_Spell_AzirQWrapper_DisplayName"
			},
			"R": {
				"abilityLevel": 0,
				"displayName": "Emperor's Divide",
				"id": "AzirR",
				"rawDescription": "GeneratedTip_Spell_AzirR_Description",
				"rawDisplayName": "GeneratedTip_Spell_AzirR_DisplayName"
			},
			"W": {
				"abilityLevel": 1,
				"displayName": "Arise!",
				"id": "AzirW",
				"rawDescription": "GeneratedTip_Spell_AzirW_Description",
				"rawDisplayName": "GeneratedTip_Spell_AzirW_DisplayName"
			}
		},
		"championStats": {
			"abilityHaste": 0.0,
			"abilityPower": 18.0,
			"armor": 25.0,
			"armorPenetrationFlat": 0.0,
			"armorPenetrationPercent": 1.0,
			"attackDamage": 56.0,
			"attackRange": 525.0,
			"attackSpeed": 0.6944000124931336,
			"bonusArmorPenetrationPercent": 1.0,
			"bonusMagicPenetrationPercent": 1.0,
			"critChance": 0.0,
			"critDamage": 200.0,
			"currentHealth": 685.0,
			"healShieldPower": 0.0,
			"healthRegenRate": 1.399999976158142,
			"lifeSteal": 0.0,
			"magicLethality": 0.0,
			"magicPenetrationFlat": 0.0,
			"magicPenetrationPercent": 1.0,
			"magicResist": 30.0,
			"maxHealth": 685.0,
			"moveSpeed": 330.0,
			"omnivamp": 0.0,
			"physicalLethality": 0.0,
			"physicalVamp": 0.0,
			"resourceMax": 320.0,
			"resourceRegenRate": 1.600000023841858,
			"resourceType": "MANA",
			"resourceValue": 320.0,
			"spellVamp": 0.0,
			"tenacity": 5.0
		},
		"currentGold": 0.0,
		"fullRunes": {
			"generalRunes": [
				{
					"displayName": "Conqueror",
					"id": 8010,
					"rawDescription": "perk_tooltip_Conqueror",
					"rawDisplayName": "perk_displayname_Conqueror"
				},
				{
					"displayName": "Presence of Mind",
					"id": 8009,
					"rawDescription": "perk_tooltip_PresenceOfMind",
					"rawDisplayName": "perk_displayname_PresenceOfMind"
				},
				{
					"displayName": "Legend: Bloodline",
					"id": 9103,
					"rawDescription": "perk_tooltip_9103",
					"rawDisplayName": "perk_displayname_9103"
				},
				{
					"displayName": "Last Stand",
					"id": 8299,
					"rawDescription": "perk_tooltip_8234",
					"rawDisplayName": "perk_displayname_8234"
				},
				{
					"displayName": "Sudden Impact",
					"id": 8143,
					"rawDescription": "perk_tooltip_SuddenImpact",
					"rawDisplayName": "perk_displayname_SuddenImpact"
				},
				{
					"displayName": "Sixth Sense",
					"id": 8137,
					"rawDescription": "perk_tooltip_SixthSense",
					"rawDisplayName": "perk_displayname_SixthSense"
				}
			],
			"keystone": {
				"displayName": "Conqueror",
				"id": 8010,
				"rawDescription": "perk_tooltip_Conqueror",
				"rawDisplayName": "perk_displayname_Conqueror"
			},
			"primaryRuneTree": {
				"displayName": "Precision",
				"id": 8000,
				"rawDescription": "perkstyle_tooltip_7201",
				"rawDisplayName": "perkstyle_displayname_7201"
			},
			"secondaryRuneTree": {
				"displayName": "Domination",
				"id": 8100,
				"rawDescription": "perkstyle_tooltip_7200",
				"rawDisplayName": "perkstyle_displayname_7200"
			},
			"statRunes": [
				{
					"id": 5005,
					"rawDescription": "perk_tooltip_StatModAttackSpeed"
				},
				{
					"id": 5001,
					"rawDescription": "perk_tooltip_StatModHealthScaling"
				},
				{
					"id": 5001,
					"rawDescription": "perk_tooltip_StatModHealthScaling"
				}
			]
		},
		"level": 1,
		"riotId": "Holmes#LOCK",
		"riotIdGameName": "Holmes",
		"riotIdTagLine": "LOCK",
		"summonerName": "Holmes#LOCK",
		"teamRelativeColors": true
	},
	"allPlayers": [
		{
			"championName": "Azir",
			"isBot": false,
			"isDead": false,
			"items": [
				{
					"canUse": false,
					"consumable": false,
					"count": 1,
					"displayName": "Doran's Ring",
					"itemID": 1056,
					"price": 400,
					"rawDescription": "GeneratedTip_Item_1056_Description",
					"rawDisplayName": "Item_1056_Name",
					"slot": 0
				},
				{
					"canUse": true,
					"consumable": true,
					"count": 2,
					"displayName": "Health Potion",
					"itemID": 2003,
					"price": 50,
					"rawDescription": "GeneratedTip_Item_2003_Description",
					"rawDisplayName": "Item_2003_Name",
					"slot": 1
				},
				{
					"canUse": true,
					"consumable": false,
					"count": 1,
					"displayName": "Stealth Ward",
					"itemID": 3340,
					"price": 0,
					"rawDescription": "GeneratedTip_Item_3340_Description",
					"rawDisplayName": "Item_3340_Name",
					"slot": 6
				}
			],
			"level": 1,
			"position": "NONE",
			"rawChampionName": "game_character_displayname_Azir",
			"rawSkinName": "game_character_skin_displayname_Azir_10",
			"respawnTimer": 0.0,
			"riotId": "Holmes#LOCK",
			"riotIdGameName": "Holmes",
			"riotIdTagLine": "LOCK",
			"runes": {
				"keystone": {
					"displayName": "Conqueror",
					"id": 8010,
					"rawDescription": "perk_tooltip_Conqueror",
					"rawDisplayName": "perk_displayname_Conqueror"
				},
				"primaryRuneTree": {
					"displayName": "Precision",
					"id": 8000,
					"rawDescription": "perkstyle_tooltip_7201",
					"rawDisplayName": "perkstyle_displayname_7201"
				},
				"secondaryRuneTree": {
					"displayName": "Domination",
					"id": 8100,
					"rawDescription": "perkstyle_tooltip_7200",
					"rawDisplayName": "perkstyle_displayname_7200"
				}
			},
			"scores": {
				"assists": 0,
				"creepScore": 0,
				"deaths": 0,
				"kills": 0,
				"wardScore": 0.0
			},
			"skinID": 10,
			"skinName": "Elderwood Azir (Emerald)",
			"summonerName": "Holmes#LOCK",
			"summonerSpells": {
				"summonerSpellOne": {
					"displayName": "Ghost",
					"rawDescription": "GeneratedTip_SummonerSpell_SummonerHaste_Description",
					"rawDisplayName": "GeneratedTip_SummonerSpell_SummonerHaste_DisplayName"
				},
				"summonerSpellTwo": {
					"displayName": "Flash",
					"rawDescription": "GeneratedTip_SummonerSpell_SummonerFlash_Description",
					"rawDisplayName": "GeneratedTip_SummonerSpell_SummonerFlash_DisplayName"
				}
			},
			"team": "ORDER"
		}
	],
	"events": {
		"Events": [
			{
				"EventID": 0,
				"EventName": "GameStart",
				"EventTime": 0.015715399757027627
			}
		]
	},
	"gameData": {
		"gameMode": "PRACTICETOOL",
		"gameTime": 24.959842681884767,
		"mapName": "Map11",
		"mapNumber": 11,
		"mapTerrain": "Default"
	}
}
```


## LCU EventData example response

```json
{
	"Events": [
		{
			"EventID": 0,
			"EventName": "GameStart",
			"EventTime": 0.018448099493980409
		},
		{
			"EventID": 1,
			"EventName": "MinionsSpawning",
			"EventTime": 30.034719467163087
		}
	]
}
```