FROM node:22-bookworm-slim

ENV NODE_ENV=development

WORKDIR /workspace/frontend

COPY docker/start-frontend.sh /usr/local/bin/start-frontend
RUN chmod +x /usr/local/bin/start-frontend

EXPOSE 5173

CMD ["/usr/local/bin/start-frontend"]
