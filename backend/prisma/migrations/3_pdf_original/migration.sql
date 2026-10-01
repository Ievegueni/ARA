-- PDF original guardado no VPS, para mostrar a página com imagens/esquemas ("Ver página no manual")
ALTER TABLE "Document" ADD COLUMN "storedName" TEXT;
CREATE UNIQUE INDEX "Document_storedName_key" ON "Document"("storedName");
