const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = '6416421723:AAGcrBVbPY9E8-bIdK_4-AeM7t1KCtpn4AA'
const chat_bot = '-1001682222531'
const chat_error = '-1002016006632'
const bot = new TelegramBot(token, { polling: false });
const app = express();

async function obterPartidas() {
    const url = "https://apiv3.apifootball.com/?action=get_events&match_live=1&APIkey=ce1a9e39eaa2a1d13ae756306d88205321727bf0a07687a249b5c9f786eca0ff";
    const response = await axios.get(url);
    return response.data;
}

async function obterOdds(idPartida){ 
    const url = `https://apiv3.apifootball.com/?action=get_odds&APIkey=ce1a9e39eaa2a1d13ae756306d88205321727bf0a07687a249b5c9f786eca0ff&match_id=${idPartida}`
    const response = await axios.get(url);
    return response.data;
}

async function enviarMensagemTelegram(chat_id,mensagem) {
    try {
        await bot.sendMessage(chat_id, mensagem, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Erro ao enviar mensagem para o Telegram:', error);
    }
}

function casaFavoritoPressao(apHome, apAway, oddHome, scoreHome, scoreAway, idPartida, minutes, partidasNotificadas){
    if((oddHome<=1.40) && ((apHome/minutes)>=1) && (apHome>apAway) && scoreHome<=scoreAway && !partidasNotificadas.has(idPartida)){
        return true
    }
}

function foraFavoritoPressao(apHome, apAway, oddAway, scoreHome, scoreAway, idPartida, minutes, partidasNotificadas){
    if((oddAway<=1.40) && ((apAway/minutes)>=1) &&  (apAway>apHome) && scoreHome>=scoreAway && !partidasNotificadas.has(idPartida)){
        return true
    }
}

const partidasEmAnalise = new Set();
const partidasNotificadas = new Set();
var qtdPartidas = 0;

async function analisarPartidas(){
    const dados = await obterPartidas();
    qtdPartidas = dados.length;
    for(let i=0; i<qtdPartidas; i++){
        const nomeHome = dados[i].match_hometeam_name;
        const nomeAway = dados[i].match_awayteam_name;
        const minutes = dados[i].match_status;
        if(minutes!='Finished' && (minutes>=20 && minutes<=25)){
            const dangerousAttacks = dados[i].statistics.find(stat => stat.type === 'Dangerous Attacks');
            partidasEmAnalise.add(`${nomeHome} x ${nomeAway}`);
            if(dangerousAttacks){
                const apHome = dangerousAttacks.home; 
                const apAway = dangerousAttacks.away;
                const idPartida = dados[i].match_id;
                const scoreHome = dados[i].match_hometeam_score;
                const scoreAway = dados[i].match_awayteam_score;
                try{
                    const odds = await obterOdds(idPartida);
                    const oddHome = odds[4].odd_1;
                    const oddAway = odds[4].odd_2;
                    if(casaFavoritoPressao(apHome,apAway,oddHome,scoreHome,scoreAway,idPartida, minutes, partidasNotificadas) || foraFavoritoPressao(apHome,apAway,oddAway,scoreHome,scoreAway,idPartida, minutes, partidasNotificadas)){
                            const mensagem = `*${nomeHome}* vs *${nomeAway}*\n\n⚽ Placar: ${scoreHome} x ${scoreAway}\n⚔️ Ataques Perigosos: ${apHome >= 20 ? '*' + apHome + '* 🔥' : apHome} x ${apAway >= 20 ? '*' + apAway + '* 🔥' : apAway}\n📈 Odds Pré: ${oddHome <= 1.40 ? oddHome + ' 👑' : oddHome} x ${oddAway <= 1.40 ? oddAway + ' 👑' : oddAway}\n🕛 Tempo: ${minutes}\n\n🤖 *Entrar em OVER GOL HT*`;
                            await enviarMensagemTelegram(chat_bot,mensagem);
                            console.log(mensagem);
                            partidasNotificadas.add(idPartida);
                    }
                    } catch (error){
                    }
                
            } 
        } else {
            partidasEmAnalise.delete(`${nomeHome} x ${nomeAway}`);
        }
    }
}

analisarPartidas()

setInterval(iniciar, 60000);

async function iniciar() {
    try {
        await analisarPartidas();
        console.log(qtdPartidas + " Jogos ao vivo,"+" Analisando " + partidasEmAnalise.size + " Partidas," + " Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]");
    } catch (error) {
        console.log(error);
        await enviarMensagemTelegram(chat_error,error);
    }
}

const port = process.env.PORT || 3003; 

app.get('/over-ht', (req, res) => {
    const horaAtual = new Date().toLocaleString();
    res.send("<b>BOT OVER HT</b><br>"+ " 🚨 "+ qtdPartidas + " Jogos ao vivo<br>"+" 🤖 Analisando " + partidasEmAnalise.size + " Partidas<br>" + " 💾 Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]<br>" + " ⏰ Hora atual: " + horaAtual);
});

app.get('/over-ht/aovivo', (req, res) => {
    const nomesDosTimes = [...partidasEmAnalise]; // Convertendo o Set para um array
    res.send(nomesDosTimes);  
});

// Inicie o servidor para ouvir na porta especificada
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
