/*
  Warnings:

  - You are about to drop the `sensor_data` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "GasType" AS ENUM ('LPG', 'METHANE', 'ALCOHOL', 'CO', 'SMOKE', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "sensor_data" DROP CONSTRAINT "sensor_data_device_id_fkey";

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "gas_type" "GasType";

-- DropTable
DROP TABLE "sensor_data";
