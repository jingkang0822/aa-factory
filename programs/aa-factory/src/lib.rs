use anchor_lang::prelude::*;
use std::mem::size_of;

declare_id!("8YWxzcPJMwGnaG3CUcxxV2PThbARj2LSAGnPrdB4mYDk");

#[program]
pub mod aa_factory {
    use super::*;

    pub fn create_escrow(ctx: Context<CreateEscrow>, salt: u64) -> Result<()> {
        msg!("Entering create_escrow");
        let escrow = &mut ctx.accounts.escrow;

        // Set from
        escrow.from = ctx.accounts.from.key();
        // Set to
        escrow.to = ctx.accounts.to.key();
        // Set salt
        escrow.salt = salt;

        Ok(())
    }
}
/// CreateEscrow context
#[derive(Accounts)]
#[instruction(salt: u64)]
pub struct CreateEscrow<'info> {
    // Escrow Account PDA
    #[account(
        init,
        seeds = [
                    b"v1.0.1".as_ref(), 
                    from.key().as_ref(), 
                    to.key().as_ref(), 
                    &salt.to_le_bytes()
                ],
        bump,
        payer = paymaster,
        space = size_of::<EscrowAccount>() + 8
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub from: Signer<'info>,

    /// CHECK: safe
    #[account(mut)]
    pub to: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub paymaster: Signer<'info>,
}

// Metadata for EscrowAccount
#[account]
pub struct EscrowAccount {
    pub from: Pubkey,
    pub to: Pubkey,
    pub salt: u64,
}
