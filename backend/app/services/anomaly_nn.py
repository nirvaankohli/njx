from __future__ import annotations

import io

import torch
from torch import nn


torch.manual_seed(7)
torch.set_num_threads(1)


class AnomalyAutoencoder(nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 8, bottleneck_dim: int = 3) -> None:
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, bottleneck_dim),
            nn.Tanh(),
        )
        self.decoder = nn.Sequential(
            nn.Linear(bottleneck_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
        )

        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.xavier_uniform_(module.weight)
            nn.init.zeros_(module.bias)

    def forward(self, value: torch.Tensor) -> torch.Tensor:
        encoded = self.encoder(value)
        return self.decoder(encoded)


def build_model(input_dim: int) -> AnomalyAutoencoder:
    model = AnomalyAutoencoder(input_dim=input_dim)
    model.eval()
    return model


def load_model(blob: bytes | None, input_dim: int) -> AnomalyAutoencoder:
    model = build_model(input_dim)
    if blob:
        buffer = io.BytesIO(blob)
        state_dict = torch.load(buffer, map_location="cpu")
        model.load_state_dict(state_dict)
    model.eval()
    return model


def dump_model(model: AnomalyAutoencoder) -> bytes:
    buffer = io.BytesIO()
    torch.save(model.state_dict(), buffer)
    return buffer.getvalue()

