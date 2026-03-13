import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
dotenv.config()

const prisma = new PrismaClient()

async function main() {
  const series = await prisma.series.findFirst({
    where: {
      posterUrl: { not: null }
    }
  })
  console.log('Poster URL:', series?.posterUrl)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
