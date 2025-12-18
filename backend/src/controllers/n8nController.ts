import { Request, Response } from 'express'
import Ticket from '../models/Ticket';
import ShowTicketService from '../services/TicketServices/ShowTicketService';
import { getIO } from '../libs/socket';
import Tag from '../models/Tag';
import TicketTag from '../models/TicketTag';
import User from '../models/User';
import Queue from '../models/Queue';


type N8nTicketData = {
  ticketId: string;
  value: string;
  type: string;
  companyId: number;
}


export const updateTicket = async (req: Request, res: Response): Promise<Response> => {

  const data = req.body as N8nTicketData;




  const { ticketId, value, type, companyId } = data;

  if (type == 'tag') {


    const tags = await Tag.findAll({ where: { companyId } });
    const fromThisCompany = tags.find((tag) => tag.id === parseInt(value));

    if (!fromThisCompany) {
      throw new Error("Tag Escolhida no N8N não pertence a empresa");
    }

    const tagsFromTicket = await TicketTag.findAll({ where: { ticketId: ticketId } });

    const tagsId = tagsFromTicket.map((tag) => tag.tagId);

    if (value && parseInt(value) > 0) {
      if (!tagsId.includes(parseInt(value))) {
        await TicketTag.create({ ticketId: ticketId, tagId: parseInt(value) });
      }
    }


    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();

    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });



    return res.json('Tag atualizada com sucesso');
  }


  if (type == 'user') {

    const users = await User.findAll({ where: { companyId } });
    const fromThisCompany = users.find((user) => user.id === parseInt(value));

    if (!fromThisCompany) {
      throw new Error("Usuário Escolhido no typebot não pertence a empresa");
    }

    await Ticket.update(
      { userId: parseInt(value) },
      { where: { id: ticketId } }
    );
    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();

    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return res.json('Usuário atualizado com sucesso');
  }


  if (type == 'queue') {

    const queues = await Queue.findAll({ where: { companyId } });

    const fromThisCompany = queues.find((queue) => queue.id === parseInt(value));

    if (!fromThisCompany) {
      throw new Error("Fila Escolhida no typebot não pertence a empresa");
    }

    await Ticket.update(
      { queueId: parseInt(value) },
      { where: { id: ticketId } }
    );

    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();

    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return res.json('Fila atualizada com sucesso');
  }


  return res.status(400).json({ error: 'Invalid type' });

}
